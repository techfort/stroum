// Stroum Runtime Support
// This file is emitted alongside transpiled code to provide stream handling utilities

import * as fs from "node:fs";
import * as net from "node:net";
import * as path from "node:path";

// ── Error types ───────────────────────────────────────────────────────────────

export class StroumStreamError extends Error {
  constructor(
    public readonly stream: string,
    public readonly value: unknown,
    public readonly cause: Error,
  ) {
    super(cause.message);
    this.name = "StroumStreamError";
    this.stack = cause.stack;
  }
}

// ── Source-map remapping (.ts → .stm) ────────────────────────────────────────

async function remapStack(stack: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { SourceMapConsumer } = require("source-map") as typeof import("source-map");
  const lines = stack.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const m = line.match(/\((.+\.ts):(\d+):(\d+)\)/);
    if (!m) { out.push(line); continue; }
    const [, tsFile, ln, col] = m;
    const mapFile = `${tsFile}.map`;
    if (!fs.existsSync(mapFile)) { out.push(line); continue; }
    try {
      const raw = JSON.parse(fs.readFileSync(mapFile, "utf-8"));
      await SourceMapConsumer.with(raw, null, (c) => {
        let pos = c.originalPositionFor({ line: Number(ln), column: Number(col) - 1 });
        // Function bodies often lack exact mappings — scan backwards to the nearest mapped line.
        if (pos.source == null) {
          for (let l = Number(ln) - 1; l >= 1 && pos.source == null; l--) {
            pos = c.originalPositionFor({ line: l, column: 0 });
          }
        }
        if (pos.source && pos.line != null) {
          const stm = path.resolve(path.dirname(tsFile), pos.source);
          out.push(line.replace(/\(.+\.ts:\d+:\d+\)/, `(${stm}:${pos.line}:${(pos.column ?? 0) + 1})`));
        } else {
          out.push(line);
        }
      });
    } catch { out.push(line); }
  }
  return out.join("\n");
}

// ── Stroum-formatted runtime error display ────────────────────────────────────

async function formatStroumError(reason: unknown): Promise<void> {
  const isStream = reason instanceof StroumStreamError;
  const err = isStream ? reason.cause : reason instanceof Error ? reason : new Error(String(reason));
  const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
  const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
  const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
  const border = red("═".repeat(63));

  process.stderr.write(`\n${border}\n${red("  STROUM RUNTIME ERROR")}\n${border}\n\n`);

  if (isStream) {
    const se = reason as StroumStreamError;
    let valueStr: string;
    try { valueStr = JSON.stringify(se.value, null, 2); } catch { valueStr = "[unserializable]"; }
    const indented = valueStr.replace(/\n/g, "\n            ");
    process.stderr.write(`  ${yellow("Stream:")}  @${se.stream}\n`);
    process.stderr.write(`  ${yellow("Value:")}   ${indented}\n`);
    process.stderr.write("\n");
  }

  process.stderr.write(`  ${red("Error:")}   ${err.message}\n`);

  if (err.stack) {
    try {
      const remapped = await remapStack(err.stack);
      const frames = remapped.split("\n")
        .slice(1)
        .filter((l) => l.trim().startsWith("at ") && !l.includes("stroum-runtime"))
        .slice(0, 6);
      if (frames.length > 0) {
        process.stderr.write(`\n  ${cyan("Trace:")}\n`);
        for (const f of frames) process.stderr.write(`    ${f.trim()}\n`);
      }
    } catch { /* ignore remapping failures */ }
  }

  process.stderr.write(`\n${border}\n\n`);
}

interface TraceEntry {
  stream: string;
  value: any;
  fn: string | null;
  args: Record<string, any>;
  ts: number;
}

interface RouteMeta {
  fn: string | null;
  args: Record<string, any>;
}

class RuntimeControl {
  private controller = new AbortController();

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  stop(): void {
    if (!this.controller.signal.aborted) {
      this.controller.abort();
    }
  }

  waitForSignal(): Promise<void> {
    return new Promise((resolve) => {
      const done = () => {
        process.off("SIGINT", done);
        process.off("SIGTERM", done);
        this.stop();
        resolve();
      };

      if (this.signal.aborted) {
        resolve();
        return;
      }

      process.once("SIGINT", done);
      process.once("SIGTERM", done);
      this.signal.addEventListener("abort", () => resolve(), { once: true });
    });
  }

  waitForStream(streamName: string): Promise<void> {
    return new Promise((resolve) => {
      if (this.signal.aborted) {
        resolve();
        return;
      }

      __router.on(streamName, async () => {
        this.stop();
        resolve();
      });
      this.signal.addEventListener("abort", () => resolve(), { once: true });
    });
  }

  waitForTimeout(ms: number): Promise<void> {
    return new Promise((resolve) => {
      if (this.signal.aborted) {
        resolve();
        return;
      }

      const timer = setTimeout(() => {
        this.stop();
        resolve();
      }, ms);

      this.signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });
  }
}

function __formatValue(v: any): string {
  try {
    const s = JSON.stringify(v);
    if (s === undefined) return String(v);
    return s.length > 64 ? s.slice(0, 61) + "..." : s;
  } catch {
    return String(v);
  }
}

export class StreamRouter {
  private handlers: Map<string, ((value: any) => void | Promise<void>)[]> =
    new Map();
  private traceHandler: ((value: any) => void | Promise<void>) | null = null;
  private metaHandler: ((value: any) => void | Promise<void>) | null = null;
  private traceLog: TraceEntry[] = [];
  private metaLog: any[] = [];
  private traceEnabled: boolean = process.env.STROUM_TRACE === "1";
  private _ipc: net.Socket | null = null;
  private streamMeta: Map<string, { type: string; count: number; lastValue: any; firstEmitAt: number }> = new Map();

  declareStream(name: string, type: string): void {
    if (!this.streamMeta.has(name)) {
      this.streamMeta.set(name, { type, count: 0, lastValue: undefined, firstEmitAt: 0 });
    }
  }

  getStreamInfo(name: string): { type: string; count: number; lastValue: any; firstEmitAt: number } | null {
    return this.streamMeta.get(name) ?? null;
  }

  connectIPC(socketPath: string): void {
    try {
      this._ipc = net.createConnection(socketPath);
      this._ipc.on("error", () => {
        this._ipc = null;
      });
    } catch {
      this._ipc = null;
    }
  }

  private _ipcWrite(msg: object): void {
    if (this._ipc) {
      try {
        this._ipc.write(JSON.stringify(msg) + "\n");
      } catch {
        this._ipc = null;
      }
    }
  }

  sendExit(code: number = 0): void {
    this._ipcWrite({ type: "exit", code });
  }

  // Emit a value to a named stream — async so handler chains fully resolve before continuing
  async emit(streamName: string, value: any, meta?: RouteMeta): Promise<void> {
    if (
      this.traceEnabled &&
      streamName !== "__trace" &&
      streamName !== "__meta"
    ) {
      this.traceLog.push({
        stream: streamName,
        value,
        fn: meta?.fn ?? null,
        args: meta?.args ?? {},
        ts: Date.now(),
      });
    }

    // Forward live events to the IPC socket (skip internal streams)
    if (!streamName.startsWith("__")) {
      this._ipcWrite({
        type: "event",
        stream: streamName,
        value,
        fn: meta?.fn ?? null,
        ts: Date.now(),
      });
    }

    // Always emit to __meta stream for metadata events
    if (streamName === "__meta") {
      if (this.traceEnabled) {
        this.metaLog.push(value);
      }
      if (this.metaHandler) {
        await this.metaHandler(value);
      }
      return;
    }

    const handlers = this.handlers.get(streamName);
    if (handlers) {
      for (const handler of handlers) {
        try {
          await handler(value);
        } catch (err) {
          const cause = err instanceof Error ? err : new Error(String(err));
          throw new StroumStreamError(streamName, value, cause);
        }
      }
    }

    // Update stream metadata if this stream was declared
    const streamInfo = this.streamMeta.get(streamName);
    if (streamInfo) {
      streamInfo.count++;
      streamInfo.lastValue = value;
      if (streamInfo.firstEmitAt === 0) streamInfo.firstEmitAt = Date.now();
    }

    // Always emit to __trace stream for debugging
    if (this.traceHandler && streamName !== "__trace") {
      await this.traceHandler({ stream: streamName, value });
    }
  }

  // Register an on-handler for a stream
  on(streamName: string, handler: (value: any) => void | Promise<void>): void {
    if (streamName === "__trace") {
      this.traceHandler = handler;
    } else if (streamName === "__meta") {
      this.metaHandler = handler;
    } else {
      if (!this.handlers.has(streamName)) {
        this.handlers.set(streamName, []);
      }
      this.handlers.get(streamName)!.push(handler);
    }
  }

  // Execute registered handlers at the end of the program
  async executeHandlers(): Promise<void> {
    // Handlers are executed as values are emitted during program execution
    // This method is called at the end to ensure all handlers have run
  }

  printSummary(): void {
    const hasTraceData = this.traceLog.length > 0;
    const hasMetaData = this.metaLog.length > 0;

    // Print clear separator between program output and trace
    console.error("\n");
    console.error(
      "═══════════════════════════════════════════════════════════════",
    );
    console.error("                     STREAM TRACE SUMMARY");
    console.error(
      "═══════════════════════════════════════════════════════════════",
    );

    if (!hasTraceData && !hasMetaData) {
      console.error("\n  (no stream emissions recorded)\n");
      return;
    }

    // Print meta events if any
    if (hasMetaData) {
      console.error(
        "\n\x1b[1m\x1b[35m┌─ Stream: __meta\x1b[0m \x1b[2m(metadata events)\x1b[0m",
      );
      console.error("\x1b[35m│\x1b[0m");
      for (let i = 0; i < this.metaLog.length; i++) {
        const event = this.metaLog[i];
        const isLast = i === this.metaLog.length - 1 && !hasTraceData;
        const prefix = isLast ? "└─" : "├─";
        if (event.kind === "schema") {
          console.error(
            `\x1b[35m${prefix}\x1b[0m Emission #${i + 1}: \x1b[36m${event.name || "unnamed"}\x1b[0m (${event.fields.length} fields) from \x1b[2m${event.source}\x1b[0m`,
          );
          const fieldLines = event.fields.map(
            (f: any) => `${f.name}: ${f.type}`,
          );
          const fieldIndent = isLast ? "   " : "│  ";
          for (const fieldLine of fieldLines) {
            console.error(
              `\x1b[35m${fieldIndent}\x1b[0m   \x1b[2m${fieldLine}\x1b[0m`,
            );
          }
        } else {
          console.error(
            `\x1b[35m${prefix}\x1b[0m Emission #${i + 1}: ${JSON.stringify(event)}`,
          );
        }
      }
      if (hasTraceData) {
        console.error("\x1b[35m└─\x1b[0m");
      }
    }

    // Print regular stream trace
    if (hasTraceData) {
      // Group by stream, preserving first-seen order
      const order: string[] = [];
      const grouped = new Map<string, TraceEntry[]>();
      for (const entry of this.traceLog) {
        if (!grouped.has(entry.stream)) {
          grouped.set(entry.stream, []);
          order.push(entry.stream);
        }
        grouped.get(entry.stream)!.push(entry);
      }

      for (let streamIdx = 0; streamIdx < order.length; streamIdx++) {
        const streamName = order[streamIdx];
        const entries = grouped.get(streamName)!;
        const isLastStream = streamIdx === order.length - 1;

        console.error("");
        console.error(
          `\x1b[1m\x1b[33m┌─ Stream: @"${streamName}"\x1b[0m \x1b[2m(${entries.length} emission${entries.length !== 1 ? "s" : ""})\x1b[0m`,
        );
        console.error("\x1b[33m│\x1b[0m");

        for (let i = 0; i < entries.length; i++) {
          const e = entries[i];
          const isLastEntry = i === entries.length - 1;
          const prefix = isLastEntry ? "└─" : "├─";

          let caller: string;
          if (e.fn) {
            const argPairs = Object.entries(e.args)
              .map(([k, v]) => `${k}: ${__formatValue(v)}`)
              .join(", ");
            caller = `\x1b[32m${e.fn}\x1b[0m(${argPairs})`;
          } else {
            caller = "\x1b[2m[top-level]\x1b[0m";
          }

          console.error(
            `\x1b[33m${prefix}\x1b[0m Emission #${i + 1}: ${caller} → \x1b[36m${__formatValue(e.value)}\x1b[0m`,
          );
        }
      }
    }

    console.error(
      "\n═══════════════════════════════════════════════════════════════\n",
    );
  }
}

// Global stream router instance
export const __router = new StreamRouter();
export const __runtimeControl = new RuntimeControl();

export async function __runUntilSignal(): Promise<void> {
  await __runtimeControl.waitForSignal();
}

export async function __runUntilStream(streamName: string): Promise<void> {
  await __runtimeControl.waitForStream(streamName);
}

export async function __runUntilTimeout(ms: number): Promise<void> {
  await __runtimeControl.waitForTimeout(ms);
}

export async function __runForever(): Promise<void> {
  await __runtimeControl.waitForSignal();
}

// Print summary at program end when tracing is enabled
if (process.env.STROUM_TRACE === "1") {
  process.once("beforeExit", () => __router.printSummary());
}

// Global error handlers — catch unhandled rejections/exceptions and surface them
// as Stroum-formatted errors instead of raw Node.js stack dumps.
process.on("unhandledRejection", (reason) => {
  formatStroumError(reason).then(() => process.exit(1)).catch(() => process.exit(1));
});
process.on("uncaughtException", (err) => {
  formatStroumError(err).then(() => process.exit(1)).catch(() => process.exit(1));
});

// Auto-connect IPC socket when env var is set
if (process.env.STROUM_IPC_SOCKET) {
  __router.connectIPC(process.env.STROUM_IPC_SOCKET);
  process.once("beforeExit", () => {
    __router.sendExit(0);
  });
}

// Helper to route a value to either a stream or return it
export async function __route(
  value: any,
  streamName?: string,
  meta?: RouteMeta,
): Promise<any> {
  if (streamName) {
    await __router.emit(streamName, value, meta);
    return value;
  }
  return value;
}

// Helper for outcome matching
export function __matchOutcome(
  value: any,
  outcomeName: string,
  handler: () => any,
): any {
  // In a real implementation, this would check if the value has an outcome field
  // For now, we assume values have shape { outcome: string, value: any }
  if (
    typeof value === "object" &&
    value !== null &&
    value.outcome === outcomeName
  ) {
    return handler();
  }
  return value;
}

// Helper for partial pipes (|?>)
export function __partialPipe(value: any, fn: (v: any) => any): any {
  if (value === null || value === undefined) {
    return value;
  }
  return fn(value);
}
