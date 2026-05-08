#!/usr/bin/env node

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { analyzeDataflow } from "./dataflow-analyzer";
import { format } from "./formatter";
import { startGraphServer } from "./graph-server";
import { Lexer } from "./lexer";
import { ModuleResolver } from "./module-resolver";
import { Parser } from "./parser";
import { replCommand } from "./repl";
import { inferSchema, schemaToStroumSource } from "./schema-deriver";
import { Transpiler } from "./transpiler";
import { Validator, type ValidationIssue } from "./validator";
import type { CompileDiagnostic } from "./diagnostics";

const VERSION = "1.0.0";

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function colorize(text: string, color: keyof typeof colors): string {
  if (process.env.NO_COLOR) return text;
  return `${colors[color]}${text}${colors.reset}`;
}

type EnrichedIssue = ValidationIssue & { file: string };

function reportDiagnostics(
  parseDiagnostics: CompileDiagnostic[],
  allIssues: EnrichedIssue[],
): { errors: EnrichedIssue[]; warnings: EnrichedIssue[]; parseErrors: CompileDiagnostic[] } {
  for (const d of parseDiagnostics) {
    const loc = d.filePath ? `${path.relative(process.cwd(), d.filePath)}:` : "";
    const tag = d.severity === "error" ? colorize("[error]", "red") : colorize("[warning]", "yellow");
    console.error(`${tag} ${loc}line ${d.line}, col ${d.column}: ${d.message}`);
  }
  const errors = allIssues.filter((i) => i.type === "error");
  const warnings = allIssues.filter((i) => i.type === "warning");
  for (const w of warnings) {
    const loc = w.file ? `${path.relative(process.cwd(), w.file)}:` : "";
    console.error(`${colorize("[warning]", "yellow")} ${loc}line ${w.location.line}, col ${w.location.column}: ${w.message}`);
  }
  for (const e of errors) {
    const loc = e.file ? `${path.relative(process.cwd(), e.file)}:` : "";
    console.error(`${colorize("[error]", "red")} ${loc}line ${e.location.line}, col ${e.location.column}: ${e.message}`);
  }
  return { errors, warnings, parseErrors: parseDiagnostics.filter((d) => d.severity === "error") };
}

function showHelp() {
  console.log(`
${colorize("Stroum", "cyan")} ${colorize(`v${VERSION}`, "bright")}
${colorize("A functional, pipe-first, stream-oriented programming language", "blue")}

${colorize("USAGE:", "bright")}
  stroum <command> [options]

${colorize("COMMANDS:", "bright")}
  ${colorize("compile", "green")} <file.stm>     Transpile Stroum to TypeScript
  ${colorize("run", "green")} <file.stm>         Compile and execute a Stroum program
  ${colorize("format", "green")} <file.stm>      Format a Stroum source file
  ${colorize("repl", "green")}                   Start interactive REPL
  ${colorize("graph", "green")} <file.stm>       Open dataflow graph in browser
  ${colorize("derive", "green")} schema <file>   Infer struct definition from CSV/JSON file
  ${colorize("init", "green")} [name]            Initialize a new Stroum project
  ${colorize("version", "green")}                Show version information
  ${colorize("help", "green")}                   Show this help message

${colorize("GRAPH OPTIONS:", "bright")}
  --port <n>              Port to serve on (default: 3847)
  --no-open               Print URL but do not auto-open browser

${colorize("RUN OPTIONS:", "bright")}
  --watch, -w             Re-run whenever the source file changes
  --trace                 Print a stream trace summary after execution

${colorize("DERIVE OPTIONS:", "bright")}
  --name <StructName>     Name for the generated struct (default: inferred from filename)
  --output <file>         Write output to file instead of stdout

${colorize("COMPILE OPTIONS:", "bright")}
  -o, --output <file>     Specify output file (default: input.ts)
  --ast                   Dump AST as JSON instead of compiling
  --no-stdlib             Disable automatic stdlib import

${colorize("MODULE SYSTEM:", "bright")}
  i:core                  Import stdlib module (auto-imported by default)
  i:"./file.stm"          Import local module
  i:core add, mul         Selective imports
  i:core as c             Qualified imports (use as c:add, c:mul)

${colorize("EXAMPLES:", "bright")}
  stroum init my-project
  stroum compile app.stm
  stroum compile app.stm -o build/app.ts
  stroum compile app.stm --ast
  stroum compile app.stm --no-stdlib
  stroum run examples/demo.stm
  stroum run examples/demo.stm --trace
  stroum graph examples/dataflow-graph.stm
  stroum graph examples/dataflow-graph.stm --port 4000 --no-open
  stroum derive schema data/users.csv --name UserRow
  stroum derive schema data/users.csv --name UserRow

${colorize("DOCUMENTATION:", "bright")}
  README.md               Getting started guide
  PHASE5-COMPLETE.md      CLI documentation
  PHASE4-COMPLETE.md      Transpiler documentation
  RUNNER.md               Execution guide
`);
}

function showVersion() {
  console.log(
    `${colorize("Stroum", "cyan")} ${colorize(`v${VERSION}`, "bright")}`,
  );
  console.log(`Node ${process.version}`);
}

function compileCommand(args: string[]) {
  const inputFile = args[0];

  if (!inputFile) {
    console.error(colorize("Error:", "red") + " input file required");
    console.error(
      "Usage: stroum compile <input.stm> [-o <output.ts>] [--ast] [--no-stdlib]",
    );
    process.exit(1);
  }

  let outputFile: string | null = null;
  let dumpAst = false;
  let useStdlib = true;

  // Parse flags
  for (let i = 1; i < args.length; i++) {
    if ((args[i] === "-o" || args[i] === "--output") && i + 1 < args.length) {
      outputFile = args[i + 1];
      i++;
    } else if (args[i] === "--ast") {
      dumpAst = true;
    } else if (args[i] === "--no-stdlib") {
      useStdlib = false;
    }
  }

  try {
    const absoluteInputFile = path.resolve(inputFile);

    // Determine stdlib path
    const stdlibPath = useStdlib
      ? path.join(__dirname, "..", "stdlib")
      : undefined;

    // Phase 1-2: Resolve all modules and parse them
    const resolver = new ModuleResolver(stdlibPath);
    resolver.loadModule(absoluteInputFile); // Load main file and all dependencies
    const modules = resolver.getModulesInOrder(); // Get all modules in dependency order

    if (dumpAst) {
      // Dump AST for all modules
      const allAsts = modules.map((mod) => ({
        path: mod.filePath,
        ast: mod.module,
      }));
      console.log(JSON.stringify(allAsts, null, 2));
      process.exit(0);
    }

    // Phase 3: Validation (validates all modules together)
    // Collect lex/parse diagnostics from all modules
    const parseDiagnostics = modules.flatMap((m) => m.diagnostics);

    const validator = new Validator(stdlibPath);
    const allIssues = [];

    for (const resolvedModule of modules) {
      const issues = validator.validate(resolvedModule.module);
      allIssues.push(
        ...issues.map((issue) => ({ ...issue, file: resolvedModule.filePath })),
      );
    }

    const { errors, parseErrors, warnings } = reportDiagnostics(parseDiagnostics, allIssues);
    if (parseErrors.length > 0 || errors.length > 0) {
      console.error(colorize(`Compilation failed with ${parseErrors.length + errors.length} error(s)`, "red"));
      process.exit(1);
    }

    // Phase 4: Transpilation
    const transpiler = new Transpiler(stdlibPath);

    // Determine output file for the main module
    if (!outputFile) {
      outputFile = inputFile.replace(/\.stm$/, ".ts");
    }

    // Transpile all modules
    for (const resolvedModule of modules) {
      let moduleOutputFile: string;
      if (resolvedModule.filePath === absoluteInputFile) {
        moduleOutputFile = outputFile;
      } else {
        moduleOutputFile = resolvedModule.filePath.replace(/\.stm$/, ".ts");
      }

      const resolvedOutput = path.resolve(moduleOutputFile);
      const { code, map } = transpiler.transpileWithMap(
        resolvedModule.module,
        resolvedModule.filePath,
        resolvedOutput,
      );

      fs.writeFileSync(moduleOutputFile, code);
      fs.writeFileSync(`${resolvedOutput}.map`, map);
    }

    // Emit runtime file in the same directory as the main output
    const outputDir = path.dirname(path.resolve(outputFile));
    Transpiler.emitRuntime(outputDir);

    console.log(colorize("✓", "green") + " Transpilation successful");
    console.log(`  Main output: ${colorize(outputFile, "cyan")}`);
    if (modules.length > 1) {
      console.log(`  ${modules.length - 1} imported module(s) compiled`);
    }
    console.log(
      `  Runtime: ${colorize(path.join(outputDir, "stroum-runtime.ts"), "cyan")}`,
    );
    if (warnings.length > 0) {
      console.log(
        colorize(`  ${warnings.length} warning(s) reported`, "yellow"),
      );
    }
  } catch (error: any) {
    console.error(colorize("Error:", "red"), error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

function watchMode(inputFile: string, runArgs: string[]): void {
  const cliScript = process.argv[1];
  let child: ReturnType<typeof spawn> | null = null;
  let debounce: ReturnType<typeof setTimeout> | null = null;

  const runOnce = () => {
    if (child) child.kill();
    console.log(colorize(`\n[watch] restarting: ${inputFile}`, "cyan"));
    child = spawn("node", [cliScript, "run", ...runArgs], { stdio: "inherit" });
    child.on("exit", () => { child = null; });
  };

  runOnce();

  fs.watch(inputFile, () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(runOnce, 300);
  });

  process.on("SIGINT", () => {
    if (child) child.kill();
    process.exit(0);
  });

  console.log(colorize(`[watch] watching ${inputFile} — press Ctrl+C to stop`, "blue"));
}

function runCommand(args: string[]) {
  const watchFlag = args.includes("--watch") || args.includes("-w");
  const traceMode = args.includes("--trace");
  const ipcIndex = args.indexOf("--ipc");
  const ipcSocket = ipcIndex !== -1 ? args[ipcIndex + 1] : null;
  const inputFile = args.find(
    (a, i) => !a.startsWith("--") && args[i - 1] !== "--ipc",
  );

  if (!inputFile) {
    console.error(colorize("Error:", "red") + " input file required");
    console.error("Usage: stroum run <input.stm> [--watch]");
    process.exit(1);
  }

  if (!fs.existsSync(inputFile)) {
    console.error(colorize("Error:", "red") + ` file not found: ${inputFile}`);
    process.exit(1);
  }

  if (watchFlag) {
    const runArgs = args.filter((a) => a !== "--watch" && a !== "-w");
    watchMode(inputFile, runArgs);
    return;
  }

  const os = require("os");
  const absoluteInputFile = path.resolve(inputFile);
  const basename = path.basename(inputFile, ".stm");
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "stroum-"));

  // Cleanup on exit
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

  console.log(colorize(`🚀 Executing Stroum file: ${inputFile}`, "cyan"));
  console.log("");

  // Step 1: Transpile to temp dir
  console.log("📝 Transpiling to TypeScript...");
  const stdlibPath = path.join(__dirname, "..", "stdlib");
  const outputTs = path.join(tempDir, `${basename}.ts`);

  try {
    const resolver = new ModuleResolver(stdlibPath);
    resolver.loadModule(absoluteInputFile);
    const modules = resolver.getModulesInOrder();

    // Collect lex/parse diagnostics
    const parseDiagnostics = modules.flatMap((m) => m.diagnostics);

    const validator = new Validator(stdlibPath);
    const allIssues: EnrichedIssue[] = [];
    for (const mod of modules) {
      const issues = validator.validate(mod.module, mod.filePath);
      allIssues.push(...issues.map((i) => ({ ...i, file: mod.filePath })));
    }

    const { errors, parseErrors } = reportDiagnostics(parseDiagnostics, allIssues);
    if (parseErrors.length > 0 || errors.length > 0) {
      console.error(colorize(`Compilation failed with ${parseErrors.length + errors.length} error(s)`, "red"));
      cleanup();
      process.exit(1);
    }

    const transpiler = new Transpiler(stdlibPath);
    for (const mod of modules) {
      const outFile =
        mod.filePath === absoluteInputFile
          ? outputTs
          : path.join(tempDir, `${path.basename(mod.filePath, ".stm")}.ts`);
      const { code, map } = transpiler.transpileWithMap(mod.module, mod.filePath, outFile);
      fs.writeFileSync(outFile, code);
      fs.writeFileSync(`${outFile}.map`, map);
    }
    Transpiler.emitRuntime(tempDir);

    // Symlink node_modules to temp directory for dependency resolution
    const projectRoot = path.join(__dirname, "..");
    const tempNodeModules = path.join(tempDir, "node_modules");
    const projectNodeModules = path.join(projectRoot, "node_modules");
    if (fs.existsSync(projectNodeModules) && !fs.existsSync(tempNodeModules)) {
      fs.symlinkSync(projectNodeModules, tempNodeModules, "dir");
    }

    // Copy schema-deriver for runtime schema inference
    const schemaDeriver = path.join(__dirname, "schema-deriver.js");
    if (fs.existsSync(schemaDeriver)) {
      fs.copyFileSync(schemaDeriver, path.join(tempDir, "schema-deriver.js"));
    }

    console.log(colorize("✓", "green") + " Transpilation successful");
    if (modules.length > 1)
      console.log(`  ${modules.length - 1} imported module(s) compiled`);
    console.log(
      `  Runtime: ${colorize(path.join(tempDir, "stroum-runtime.ts"), "cyan")}`,
    );
  } catch (err: any) {
    console.error(colorize("Error:", "red"), err.message);
    cleanup();
    process.exit(1);
  }

  // Step 2: Compile TS → JS
  console.log("📝 Compiling to JavaScript...");
  const tscPath = path.join(__dirname, "..", "node_modules", ".bin", "tsc");
  const tscArgs = [
    outputTs,
    path.join(tempDir, "stroum-runtime.ts"),
    path.join(tempDir, "stdlib-runtime.ts"),
    "--outDir",
    tempDir,
    "--module",
    "commonjs",
    "--target",
    "es2020",
    "--moduleResolution",
    "node",
    "--esModuleInterop",
    "true",
    "--skipLibCheck",
    "--sourceMap",
  ];

  const tscResult = require("child_process").spawnSync(tscPath, tscArgs, {
    cwd: __dirname,
    encoding: "utf-8",
  });
  if (tscResult.stdout) process.stderr.write(tscResult.stdout);
  if (tscResult.stderr) process.stderr.write(tscResult.stderr);

  // Step 3: Execute
  console.log("📝 Executing...");
  console.log("");
  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
  console.log("                    STROUM PROGRAM OUTPUT");
  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
  console.log("");

  const outputJs = path.join(tempDir, `${basename}.js`);
  if (!fs.existsSync(outputJs)) {
    console.error(
      colorize("Error:", "red") +
        " Compilation produced no output. Check TypeScript errors above.",
    );
    cleanup();
    process.exit(1);
  }

  // Run with the original cwd so relative paths in the program resolve correctly.
  // Module imports (require('./stroum-runtime')) resolve relative to the .js file, not cwd.
  const nodeEnv = { ...process.env };
  if (traceMode) nodeEnv.STROUM_TRACE = "1";
  if (ipcSocket) nodeEnv.STROUM_IPC_SOCKET = ipcSocket;

  const nodeResult = spawn("node", ["--enable-source-maps", outputJs], {
    stdio: "inherit",
    env: nodeEnv,
  });
  nodeResult.on("exit", (code) => {
    if (code === 0) {
      console.log(colorize("✅ Execution complete!", "green"));
    } else {
      console.log(colorize(`❌ Process exited with code ${code}`, "red"));
    }
    cleanup();
    process.exit(code || 0);
  });
  nodeResult.on("error", (err) => {
    console.error(colorize("Error:", "red"), err.message);
    cleanup();
    process.exit(1);
  });
}

function initCommand(args: string[]) {
  const projectName = args[0] || "my-stroum-project";
  const projectPath = path.resolve(process.cwd(), projectName);

  if (fs.existsSync(projectPath)) {
    console.error(
      colorize("Error:", "red") + ` directory already exists: ${projectName}`,
    );
    process.exit(1);
  }

  console.log(
    colorize("✨ Creating new Stroum project:", "cyan") + ` ${projectName}`,
  );

  // Create project directory
  fs.mkdirSync(projectPath);
  fs.mkdirSync(path.join(projectPath, "src"));

  // Create a sample Stroum file
  const sampleStm = `-- Hello World in Stroum
-- A simple example demonstrating pipe operations

f:double x => multiply(x, 2)

f:add a b => plus(a, b)

f:compute => add(double(5), double(3))

-- Execute and print result
compute()
`;

  fs.writeFileSync(path.join(projectPath, "src", "hello.stm"), sampleStm);

  // Create README
  const readme = `# ${projectName}

A Stroum project

## Getting Started

Compile your Stroum files:

\`\`\`bash
stroum compile src/hello.stm
\`\`\`

Run directly:

\`\`\`bash
stroum run src/hello.stm
\`\`\`

## Learn More

- [Stroum Documentation](../README.md)
- [Language Specification](../PHASE4-COMPLETE.md)
`;

  fs.writeFileSync(path.join(projectPath, "README.md"), readme);

  console.log();
  console.log(colorize("✓", "green") + " Created project structure:");
  console.log(`  ${projectName}/`);
  console.log(`  ├── src/`);
  console.log(`  │   └── hello.stm`);
  console.log(`  └── README.md`);
  console.log();
  console.log("Next steps:");
  console.log(`  ${colorize("cd", "cyan")} ${projectName}`);
  console.log(`  ${colorize("stroum run", "cyan")} src/hello.stm`);
  console.log();
}

function formatCommand(args: string[]) {
  const inputFile = args.find((a) => !a.startsWith("-"));
  const inPlace = args.includes("--write") || args.includes("-w");
  const check = args.includes("--check");

  if (!inputFile) {
    console.error(colorize("Error:", "red") + " input file required");
    console.error("Usage: stroum format <file.stm> [--write] [--check]");
    process.exit(1);
  }

  if (!fs.existsSync(inputFile)) {
    console.error(colorize("Error:", "red") + ` file not found: ${inputFile}`);
    process.exit(1);
  }

  try {
    const source = fs.readFileSync(inputFile, "utf-8");
    const tokens = new Lexer(source).tokenize();
    const module = new Parser(tokens).parse();
    const formatted = format(module);

    if (check) {
      if (source === formatted) {
        console.log(
          colorize("✓", "green") + ` ${inputFile} is already formatted`,
        );
      } else {
        console.error(colorize("✗", "red") + ` ${inputFile} needs formatting`);
        process.exit(1);
      }
    } else if (inPlace) {
      fs.writeFileSync(inputFile, formatted);
      console.log(colorize("✓", "green") + ` Formatted ${inputFile}`);
    } else {
      process.stdout.write(formatted);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(colorize("Error:", "red"), msg);
    process.exit(1);
  }
}

function deriveCommand(args: string[]) {
  if (args.length === 0 || args[0] !== "schema") {
    console.error(colorize("Error:", "red") + " derive requires a subcommand");
    console.error(
      "Usage: stroum derive schema <file> [--name <StructName>] [--output <file>]",
    );
    process.exit(1);
  }

  const inputFile = args[1];
  if (!inputFile) {
    console.error(colorize("Error:", "red") + " input file required");
    console.error(
      "Usage: stroum derive schema <file> [--name <StructName>] [--output <file>]",
    );
    process.exit(1);
  }

  if (!fs.existsSync(inputFile)) {
    console.error(colorize("Error:", "red") + ` file not found: ${inputFile}`);
    process.exit(1);
  }

  // Parse flags
  let structName: string | null = null;
  let outputFile: string | null = null;

  for (let i = 2; i < args.length; i++) {
    if (args[i] === "--name" && i + 1 < args.length) {
      structName = args[i + 1];
      i++;
    } else if (args[i] === "--output" && i + 1 < args.length) {
      outputFile = args[i + 1];
      i++;
    }
  }

  // Default struct name from filename
  if (!structName) {
    const basename = path.basename(inputFile, path.extname(inputFile));
    // Capitalize first letter and make valid type name
    structName =
      basename.charAt(0).toUpperCase() +
      basename.slice(1).replace(/[^a-zA-Z0-9]/g, "");
  }

  try {
    const schema = inferSchema(inputFile, structName);
    const source = schemaToStroumSource(schema);

    if (outputFile) {
      fs.writeFileSync(outputFile, source + "\n");
      console.log(
        colorize("✓", "green") + ` Struct definition written to ${outputFile}`,
      );
    } else {
      console.log(source);
    }
  } catch (err: any) {
    console.error(colorize("Error:", "red"), err.message);
    process.exit(1);
  }
}

function findTestFiles(target: string): string[] {
  const stat = fs.statSync(target, { throwIfNoEntry: false });
  if (!stat) return [];
  if (stat.isFile()) return target.endsWith(".stm") ? [target] : [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules") {
      results.push(...findTestFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".test.stm")) {
      results.push(full);
    }
  }
  return results;
}

function runTestFile(inputFile: string): Promise<number> {
  return new Promise((resolve) => {
    const os = require("os");
    const absoluteInputFile = path.resolve(inputFile);
    const basename = path.basename(inputFile, ".stm");
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "stroum-test-"));
    const cleanup = () => {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    };

    const stdlibPath = path.join(__dirname, "..", "stdlib");
    const outputTs = path.join(tempDir, `${basename}.ts`);

    try {
      const resolver = new ModuleResolver(stdlibPath);
      resolver.loadModule(absoluteInputFile);
      const modules = resolver.getModulesInOrder();

      const validator = new Validator(stdlibPath);
      for (const mod of modules) {
        const issues = validator.validate(mod.module, mod.filePath);
        const errors = issues.filter((i: any) => i.type === "error");
        if (errors.length > 0) {
          for (const e of errors) {
            console.error(
              colorize("[error]", "red") +
                ` ${path.relative(process.cwd(), mod.filePath)}:line ${e.location.line}, col ${e.location.column}: ${e.message}`,
            );
          }
          cleanup();
          resolve(1);
          return;
        }
      }

      const transpiler = new Transpiler(stdlibPath);
      for (const mod of modules) {
        const outFile =
          mod.filePath === absoluteInputFile
            ? outputTs
            : path.join(tempDir, `${path.basename(mod.filePath, ".stm")}.ts`);
        const { code, map } = transpiler.transpileWithMap(mod.module, mod.filePath, outFile);
        fs.writeFileSync(outFile, code);
        fs.writeFileSync(`${outFile}.map`, map);
      }
      Transpiler.emitRuntime(tempDir);

      const projectRoot = path.join(__dirname, "..");
      const tempNodeModules = path.join(tempDir, "node_modules");
      const projectNodeModules = path.join(projectRoot, "node_modules");
      if (
        fs.existsSync(projectNodeModules) &&
        !fs.existsSync(tempNodeModules)
      ) {
        fs.symlinkSync(projectNodeModules, tempNodeModules, "dir");
      }
    } catch (err: any) {
      console.error(colorize("Error:", "red"), err.message);
      cleanup();
      resolve(1);
      return;
    }

    const tscPath = path.join(__dirname, "..", "node_modules", ".bin", "tsc");
    const tscArgs = [
      outputTs,
      path.join(tempDir, "stroum-runtime.ts"),
      path.join(tempDir, "stdlib-runtime.ts"),
      "--outDir",
      tempDir,
      "--module",
      "commonjs",
      "--target",
      "es2020",
      "--moduleResolution",
      "node",
      "--esModuleInterop",
      "true",
      "--skipLibCheck",
      "--sourceMap",
    ];
    const tscResult = require("child_process").spawnSync(tscPath, tscArgs, {
      encoding: "utf-8",
    });
    if (tscResult.stderr) process.stderr.write(tscResult.stderr);

    const outputJs = path.join(tempDir, `${basename}.js`);
    if (!fs.existsSync(outputJs)) {
      console.error(
        colorize("Error:", "red") + " TypeScript compilation failed",
      );
      cleanup();
      resolve(1);
      return;
    }

    const child = spawn("node", ["--enable-source-maps", outputJs], { stdio: "inherit" });
    child.on("exit", (code) => {
      cleanup();
      resolve(code ?? 1);
    });
    child.on("error", (err) => {
      console.error(err.message);
      cleanup();
      resolve(1);
    });
  });
}

async function testCommand(args: string[]) {
  const targets = args.filter((a) => !a.startsWith("--"));
  const searchRoots = targets.length > 0 ? targets : ["."];

  const testFiles: string[] = [];
  for (const root of searchRoots) {
    testFiles.push(...findTestFiles(root));
  }

  if (testFiles.length === 0) {
    console.log(
      colorize("No test files found", "yellow") + " (looking for *.test.stm)",
    );
    process.exit(0);
  }

  console.log(colorize(`Running ${testFiles.length} test file(s)`, "cyan"));
  console.log("");

  let anyFailed = false;
  for (const file of testFiles) {
    console.log(colorize(path.relative(process.cwd(), file), "bright"));
    const code = await runTestFile(file);
    if (code !== 0) anyFailed = true;
    console.log("");
  }

  process.exit(anyFailed ? 1 : 0);
}

async function graphCommand(args: string[]) {
  const DEFAULT_PORT = 3847;
  let port = DEFAULT_PORT;
  let openBrowser = true;
  let inputFile: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--port" || args[i] === "-p") && i + 1 < args.length) {
      const parsed = parseInt(args[i + 1], 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 65535) {
        console.error(
          colorize("Error:", "red") + ` invalid port: ${args[i + 1]}`,
        );
        process.exit(1);
      }
      port = parsed;
      i++;
    } else if (args[i] === "--no-open") {
      openBrowser = false;
    } else if (!args[i].startsWith("-")) {
      inputFile = args[i];
    }
  }

  if (!inputFile) {
    console.error(colorize("Error:", "red") + " input file required");
    console.error("Usage: stroum graph <input.stm> [--port <n>] [--no-open]");
    process.exit(1);
  }

  if (!fs.existsSync(inputFile)) {
    console.error(colorize("Error:", "red") + ` file not found: ${inputFile}`);
    process.exit(1);
  }

  try {
    const absoluteInputFile = path.resolve(inputFile);
    const stdlibPath = path.join(__dirname, "..", "stdlib");

    const resolver = new ModuleResolver(stdlibPath);
    resolver.loadModule(absoluteInputFile);
    const modules = resolver.getModulesInOrder();

    const mainModule = modules.find((m) => m.filePath === absoluteInputFile);
    if (!mainModule) {
      console.error(
        colorize("Error:", "red") +
          " could not locate main module after resolution",
      );
      process.exit(1);
    }

    const graph = analyzeDataflow(mainModule.module);
    const graphJson = JSON.stringify(graph);
    const filename = path.basename(inputFile);

    const server = await startGraphServer({
      port,
      graphJson,
      distDir: __dirname,
      filename,
    });
    const addr = server.address() as { port: number };
    const actualPort = addr.port;
    const url = `http://localhost:${actualPort}`;

    console.log(
      colorize("✓", "green") +
        ` Dataflow graph ready at ${colorize(url, "cyan")}`,
    );
    console.log(`  File: ${inputFile}`);
    console.log(`  Press Ctrl+C to stop`);

    if (openBrowser) {
      openUrl(url);
    }
  } catch (err: any) {
    if (err.code === "EADDRINUSE") {
      console.error(
        colorize("Error:", "red") +
          ` port ${port} is already in use. Try --port <other>`,
      );
    } else {
      console.error(colorize("Error:", "red"), err.message);
    }
    process.exit(1);
  }
}

function openUrl(url: string): void {
  const platform = process.platform;
  // WSL: prefer wslview (wslu package) or powershell.exe fallback
  const isWsl = platform === "linux" && !!process.env.WSL_DISTRO_NAME;
  const cmd =
    platform === "darwin"
      ? "open"
      : platform === "win32"
        ? "start"
        : isWsl
          ? "wslview"
          : "xdg-open";
  const child = spawn(cmd, [url], {
    detached: true,
    stdio: "ignore",
    shell: platform === "win32",
  });
  child.on("error", () => {
    // Browser open failed silently — user can visit the URL manually
  });
  child.unref();
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    showHelp();
    process.exit(0);
  }

  const command = args[0];
  const commandArgs = args.slice(1);

  switch (command) {
    case "compile":
      compileCommand(commandArgs);
      break;

    case "run":
      runCommand(commandArgs);
      break;

    case "test":
      testCommand(commandArgs);
      break;

    case "graph":
      graphCommand(commandArgs);
      break;

    case "derive":
      deriveCommand(commandArgs);
      break;

    case "format":
      formatCommand(commandArgs);
      break;

    case "repl":
      replCommand();
      break;

    case "init":
      initCommand(commandArgs);
      break;

    case "version":
    case "-v":
    case "--version":
      showVersion();
      break;

    case "help":
    case "-h":
    case "--help":
      showHelp();
      break;

    default:
      console.error(colorize("Error:", "red") + ` unknown command: ${command}`);
      console.error(
        "Run " + colorize("stroum help", "cyan") + " for usage information",
      );
      process.exit(1);
  }
}

main();
