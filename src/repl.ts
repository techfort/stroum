import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as readline from "node:readline";
import { getStdlibNames } from "./lsp-completion";
import { ModuleResolver } from "./module-resolver";
import { Transpiler } from "./transpiler";

const VERSION = "1.0.0";

const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

function c(text: string, color: keyof typeof colors): string {
  if (process.env.NO_COLOR) return text;
  return `${colors[color]}${text}${colors.reset}`;
}

interface ReplSession {
  imports: string[];
  declarations: string[];
}

export function isDeclaration(line: string): boolean {
  // f:name — function; s:Name — struct; rec f:name — recursive function
  // :name expr — binding (short); b: :name expr — binding (explicit sigil)
  return (
    /^f:\w/.test(line) ||
    /^s:\w/.test(line) ||
    /^rec\s+f:\w/.test(line) ||
    /^b:\s+:\w/.test(line) ||
    /^:\w+\s+/.test(line)
  );
}

export function extractName(line: string): string {
  const m =
    line.match(/^f:(\w+)/) ||
    line.match(/^s:(\w+)/) ||
    line.match(/^rec\s+f:(\w+)/) ||
    line.match(/^b:\s+:(\w+)/) ||
    line.match(/^:(\w+)/);
  return m ? m[1] : "it";
}

export function needsContinuation(line: string): boolean {
  const t = line.trimEnd();
  return t.endsWith("=>") || t.endsWith("|>") || t.endsWith(",");
}

function hasExplicitOutput(source: string): boolean {
  const s = source.trimEnd();
  const outputSinks = ["println", "print", "null_sink", "log_sink", "debug"];
  if (outputSinks.some((fn) => s.endsWith(`|> ${fn}`))) return true;
  if (outputSinks.some((fn) => new RegExp(`\\b${fn}\\s*\\(`).test(s))) return true;
  // stream emit: @ "name" or @binding
  if (/ @["a-zA-Z]/.test(s)) return true;
  return false;
}

export async function evalExpression(
  source: string,
  session: ReplSession,
  tempDir: string,
  stdlibPath: string,
): Promise<void> {
  // Auto-print the result unless the expression already has explicit output
  const evalSource = hasExplicitOutput(source) ? source : `${source} |> println`;

  const fullSource = [...session.imports, ...session.declarations, evalSource].join(
    "\n",
  );

  const stmFile = path.join(tempDir, "repl-eval.stm");
  const tsFile = path.join(tempDir, "repl-eval.ts");
  // .mjs so Node treats the ESM bundle correctly (needed for top-level await)
  const bundleFile = path.join(tempDir, "repl-bundle.mjs");

  fs.writeFileSync(stmFile, fullSource);

  try {
    const resolver = new ModuleResolver(stdlibPath);
    resolver.loadModule(stmFile);
    const modules = resolver.getModulesInOrder();

    const parseErrors = modules
      .flatMap((m) => m.diagnostics)
      .filter((d) => d.severity === "error");

    if (parseErrors.length > 0) {
      for (const e of parseErrors) {
        const loc = e.line ? ` (line ${e.line})` : "";
        console.error(c(`error${loc}: ${e.message}`, "red"));
      }
      return;
    }

    const transpiler = new Transpiler(stdlibPath);
    for (const mod of modules) {
      const tsCode = transpiler.transpile(mod.module, mod.filePath);
      const outFile =
        mod.filePath === stmFile
          ? tsFile
          : path.join(tempDir, `${path.basename(mod.filePath, ".stm")}.ts`);
      fs.writeFileSync(outFile, tsCode);
    }

    // Bundle with esbuild using ESM format — required for top-level await in bindings
    const esbuild = require("esbuild");
    await esbuild.build({
      entryPoints: [tsFile],
      bundle: true,
      outfile: bundleFile,
      platform: "node",
      format: "esm",
      target: "node18",
      logLevel: "silent",
    });

    const result = spawnSync("node", [bundleFile], {
      stdio: ["ignore", "inherit", "pipe"],
      cwd: process.cwd(),
      env: process.env,
      timeout: 10_000,
    });

    if (result.stderr && result.stderr.length > 0) {
      const msg = result.stderr.toString().trim();
      if (msg) console.error(c(msg, "red"));
    }

    if (result.status !== 0 && result.status !== null) {
      if (result.signal === "SIGTERM") {
        console.error(c("error: execution timed out after 10s", "red"));
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(c(`error: ${msg}`, "red"));
  }
}

export async function replCommand(): Promise<void> {
  const stdlibPath = path.join(__dirname, "..", "stdlib");
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "stroum-repl-"));

  const cleanup = () => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  };
  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });

  // Symlink node_modules so runtime deps resolve
  const projectRoot = path.join(__dirname, "..");
  const projectNodeModules = path.join(projectRoot, "node_modules");
  const tempNodeModules = path.join(tempDir, "node_modules");
  if (fs.existsSync(projectNodeModules) && !fs.existsSync(tempNodeModules)) {
    fs.symlinkSync(projectNodeModules, tempNodeModules, "dir");
  }

  Transpiler.emitRuntime(tempDir);

  const session: ReplSession = { imports: [], declarations: [] };
  let multiLineBuffer: string[] = [];
  const isInteractive = process.stdin.isTTY;

  const completer = (line: string): [string[], string] => {
    // Extract the partial word at the end of the line
    const partial = line.match(/[\w:]*$/)?.[0] ?? "";
    const sessionNames = session.declarations
      .map((d) => extractName(d))
      .filter((n) => n !== "it");
    const allNames = [...getStdlibNames(), ...sessionNames];
    const hits = partial
      ? allNames.filter((n) => n.startsWith(partial))
      : allNames;
    return [hits, partial];
  };

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: isInteractive,
    completer: isInteractive ? completer : undefined,
  });

  console.log(
    `${c("Stroum", "cyan")} REPL ${c(`v${VERSION}`, "dim")} — ${c(":help", "dim")} for commands, ${c(":quit", "dim")} to exit`,
  );

  const printPrompt = () => {
    if (isInteractive) {
      process.stdout.write(multiLineBuffer.length > 0 ? "... " : ">>> ");
    }
  };

  const processInput = async (input: string): Promise<void> => {
    const trimmed = input.trim();
    if (!trimmed) return;

    // REPL meta-commands
    if (trimmed === ":quit" || trimmed === ":q" || trimmed === ":exit") {
      rl.close();
      cleanup();
      process.exit(0);
    }

    if (trimmed === ":help") {
      console.log(
        [
          "",
          `  ${c(":quit", "cyan")} / ${c(":q", "cyan")}       Exit the REPL`,
          `  ${c(":reset", "cyan")}           Clear all session declarations`,
          `  ${c(":session", "cyan")}         Show accumulated session source`,
          `  ${c(":help", "cyan")}            Show this message`,
          "",
          `  ${c("i:core", "yellow")}                  Import stdlib module`,
          `  ${c("f:double n => mul(n,2)", "yellow")}      Define a function`,
          `  ${c(":x 42", "yellow")}                    Define a binding`,
          `  ${c("42 |> print", "yellow")}               Evaluate and print`,
          "",
        ].join("\n"),
      );
      return;
    }

    if (trimmed === ":reset") {
      session.imports.length = 0;
      session.declarations.length = 0;
      console.log(c("session cleared", "dim"));
      return;
    }

    if (trimmed === ":session") {
      const lines = [...session.imports, ...session.declarations];
      if (lines.length === 0) {
        console.log(c("(empty session)", "dim"));
      } else {
        console.log(lines.join("\n"));
      }
      return;
    }

    // Import declaration
    if (trimmed.startsWith("i:")) {
      if (!session.imports.includes(trimmed)) {
        session.imports.push(trimmed);
        console.log(c("imported", "dim"));
      } else {
        console.log(c("(already imported)", "dim"));
      }
      return;
    }

    // Function / binding / struct declaration
    if (isDeclaration(trimmed)) {
      const name = extractName(trimmed);
      session.declarations.push(trimmed);
      console.log(c(`defined ${name}`, "dim"));
      return;
    }

    // Expression — compile and run
    await evalExpression(trimmed, session, tempDir, stdlibPath);
  };

  // Serialize concurrent line events through a promise chain
  let queue: Promise<void> = Promise.resolve();

  rl.on("line", (line) => {
    queue = queue.then(async () => {
      if (multiLineBuffer.length > 0 || needsContinuation(line)) {
        multiLineBuffer.push(line);
        if (!needsContinuation(line)) {
          const full = multiLineBuffer.join("\n");
          multiLineBuffer = [];
          await processInput(full);
        }
      } else {
        await processInput(line);
      }
      printPrompt();
    });
  });

  rl.on("close", () => {
    queue.then(() => {
      if (isInteractive) console.log(c("\nBye!", "dim"));
      cleanup();
      process.exit(0);
    });
  });

  printPrompt();
}
