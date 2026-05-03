// Stroum Runtime Support
// This file is emitted alongside transpiled code to provide stream handling utilities

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

function __formatValue(v: any): string {
  try {
    const s = JSON.stringify(v);
    if (s === undefined) return String(v);
    return s.length > 64 ? s.slice(0, 61) + '...' : s;
  } catch {
    return String(v);
  }
}

export class StreamRouter {
  private handlers: Map<string, ((value: any) => void | Promise<void>)[]> = new Map();
  private traceHandler: ((value: any) => void | Promise<void>) | null = null;
  private metaHandler: ((value: any) => void | Promise<void>) | null = null;
  private traceLog: TraceEntry[] = [];
  private metaLog: any[] = [];
  private traceEnabled: boolean = process.env.STROUM_TRACE === '1';

  // Emit a value to a named stream — async so handler chains fully resolve before continuing
  async emit(streamName: string, value: any, meta?: RouteMeta): Promise<void> {
    if (this.traceEnabled && streamName !== '__trace' && streamName !== '__meta') {
      this.traceLog.push({
        stream: streamName,
        value,
        fn: meta?.fn ?? null,
        args: meta?.args ?? {},
        ts: Date.now(),
      });
    }

    // Always emit to __meta stream for metadata events
    if (streamName === '__meta') {
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
        await handler(value);
      }
    }

    // Always emit to __trace stream for debugging
    if (this.traceHandler && streamName !== '__trace') {
      await this.traceHandler({ stream: streamName, value });
    }
  }

  // Register an on-handler for a stream
  on(streamName: string, handler: (value: any) => void | Promise<void>): void {
    if (streamName === '__trace') {
      this.traceHandler = handler;
    } else if (streamName === '__meta') {
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
    console.error('\n');
    console.error('═══════════════════════════════════════════════════════════════');
    console.error('                     STREAM TRACE SUMMARY');
    console.error('═══════════════════════════════════════════════════════════════');

    if (!hasTraceData && !hasMetaData) {
      console.error('\n  (no stream emissions recorded)\n');
      return;
    }

    // Print meta events if any
    if (hasMetaData) {
      console.error('\n\x1b[1m\x1b[35m┌─ Stream: __meta\x1b[0m \x1b[2m(metadata events)\x1b[0m');
      console.error('\x1b[35m│\x1b[0m');
      for (let i = 0; i < this.metaLog.length; i++) {
        const event = this.metaLog[i];
        const isLast = i === this.metaLog.length - 1 && !hasTraceData;
        const prefix = isLast ? '└─' : '├─';
        if (event.kind === 'schema') {
          console.error(`\x1b[35m${prefix}\x1b[0m Emission #${i + 1}: \x1b[36m${event.name || 'unnamed'}\x1b[0m (${event.fields.length} fields) from \x1b[2m${event.source}\x1b[0m`);
          const fieldLines = event.fields.map((f: any) => `${f.name}: ${f.type}`);
          const fieldIndent = isLast ? '   ' : '│  ';
          for (const fieldLine of fieldLines) {
            console.error(`\x1b[35m${fieldIndent}\x1b[0m   \x1b[2m${fieldLine}\x1b[0m`);
          }
        } else {
          console.error(`\x1b[35m${prefix}\x1b[0m Emission #${i + 1}: ${JSON.stringify(event)}`);
        }
      }
      if (hasTraceData) {
        console.error('\x1b[35m└─\x1b[0m');
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
        
        console.error('');
        console.error(`\x1b[1m\x1b[33m┌─ Stream: @"${streamName}"\x1b[0m \x1b[2m(${entries.length} emission${entries.length !== 1 ? 's' : ''})\x1b[0m`);
        console.error('\x1b[33m│\x1b[0m');
        
        for (let i = 0; i < entries.length; i++) {
          const e = entries[i];
          const isLastEntry = i === entries.length - 1;
          const prefix = isLastEntry ? '└─' : '├─';
          
          let caller: string;
          if (e.fn) {
            const argPairs = Object.entries(e.args)
              .map(([k, v]) => `${k}: ${__formatValue(v)}`)
              .join(', ');
            caller = `\x1b[32m${e.fn}\x1b[0m(${argPairs})`;
          } else {
            caller = '\x1b[2m[top-level]\x1b[0m';
          }
          
          console.error(`\x1b[33m${prefix}\x1b[0m Emission #${i + 1}: ${caller} → \x1b[36m${__formatValue(e.value)}\x1b[0m`);
        }
      }
    }

    console.error('\n═══════════════════════════════════════════════════════════════\n');
  }
}

// Global stream router instance
export const __router = new StreamRouter();

// Print summary at program end when tracing is enabled
if (process.env.STROUM_TRACE === '1') {
  process.on('beforeExit', () => __router.printSummary());
}

// Helper to route a value to either a stream or return it
export async function __route(value: any, streamName?: string, meta?: RouteMeta): Promise<any> {
  if (streamName) {
    await __router.emit(streamName, value, meta);
    return undefined; // Stream emit doesn't return a value
  }
  return value;
}

// Helper for outcome matching
export function __matchOutcome(value: any, outcomeName: string, handler: () => any): any {
  // In a real implementation, this would check if the value has an outcome field
  // For now, we assume values have shape { outcome: string, value: any }
  if (typeof value === 'object' && value !== null && value.outcome === outcomeName) {
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
