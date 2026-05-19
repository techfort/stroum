import * as fs from "fs";
import * as path from "path";
import type * as AST from "./ast";
import { Lexer } from "./lexer";
import { Parser } from "./parser";
import type { IngestDirectiveData } from "./preprocessor";
import type { SourceLocation } from "./types";

export class Transpiler {
  private indent = 0;
  private output: string[] = [];
  private stdlibPath: string;
  private currentFn: { name: string; params: string[] } | null = null;
  private genLineCount = 1;
  private srcMappings: Array<{ genLine: number; srcLine: number; srcCol: number }> = [];

  constructor(stdlibPath?: string) {
    this.stdlibPath = stdlibPath || path.join(__dirname, "../stdlib");
  }

  transpile(
    module: AST.Module,
    currentFilePath?: string,
    ingestDirectives: IngestDirectiveData[] = [],
  ): string {
    this.indent = 0;
    this.output = [];
    this.genLineCount = 1;
    this.srcMappings = [];

    // Emit runtime import
    this.emit(
      `import { __router, __route, __matchOutcome, __partialPipe, __runtimeControl, __runUntilSignal, __runUntilStream, __runUntilTimeout, __runForever } from './stroum-runtime';`,
    );

    // Auto-import stdlib functions (unless --no-stdlib was used)
    if (this.stdlibPath) {
      this.emit(
        `import { add, sub, mul, div, mod, pow, abs, min, max, eq, neq, gt, gte, lt, lte, and, or, not, concat, length, upper, lower, trim, split, join, starts_with, ends_with, contains, map, filter, reduce, head, tail, take, drop, reverse, sort, is_empty, nth, each, zip, flatten, count, from_list, print, println, null_sink, log_sink, debug, trace, to_string, to_int, to_float, error, try_catch, infer_schema, read_csv, read_json, assert, assert_eq, assert_neq, assert_contains, assert_raises, stream_info } from './stdlib-runtime';`,
      );
    }

    // Add fs import when ingest directives need file reading at runtime
    if (ingestDirectives.length > 0) {
      this.emit(`import * as __fs from 'node:fs';`);
    }

    // Emit imports for imported modules
    if (module.imports.length > 0) {
      this.emit("");
      for (const importDecl of module.imports) {
        this.transpileImport(importDecl, currentFilePath);
      }
    }

    this.emit("");

    // Transpile type declarations
    for (const typeDecl of module.typeDeclarations) {
      this.transpileTypeDeclaration(typeDecl);
    }

    if (module.typeDeclarations.length > 0) {
      this.emit("");
    }

    // Transpile struct declarations (as TypeScript interfaces)
    for (const def of module.definitions) {
      if (def.type === "StructDeclaration") {
        this.transpileStructDeclaration(def);
      }
    }

    // Transpile function and binding declarations
    for (const def of module.definitions) {
      if (def.type === "FunctionDeclaration") {
        this.transpileFunctionDeclaration(def);
      } else if (def.type === "BindingDeclaration") {
        this.transpileBindingDeclaration(def);
      }
    }

    // Transpile main program
    if (
      module.streamDeclarations.length > 0 ||
      module.wireDeclarations.length > 0 ||
      module.sourceDeclarations.length > 0 ||
      module.sinkDeclarations.length > 0 ||
      module.primaryExpressions.length > 0 ||
      module.contingencies.length > 0 ||
      module.runtimeDeclaration ||
      ingestDirectives.length > 0
    ) {
      this.emit("");
      this.emit("// Main program");
      this.emit("(async () => {");
      this.indent++;
      this.emit("const __sourceTasks: Promise<any>[] = [];");

      // Declare typed streams first so metadata is available before any emissions
      for (const streamDecl of module.streamDeclarations) {
        this.emit(`__router.declareStream(${JSON.stringify(streamDecl.name)}, ${JSON.stringify(streamDecl.valueType)});`);
      }

      // Register wire relays before other handlers
      for (const wireDecl of module.wireDeclarations) {
        this.transpileWireDeclaration(wireDecl);
      }

      // Register on-handlers and route declarations first
      for (const contingency of module.contingencies) {
        if (contingency.type === "OnHandler") {
          this.transpileOnHandler(contingency);
        } else if (contingency.type === "RouteDeclaration") {
          this.transpileRouteDeclaration(contingency);
        }
      }

      for (const sinkDecl of module.sinkDeclarations) {
        this.transpileSinkDeclaration(sinkDecl);
      }

      // Start declared sources after handlers are registered.
      for (const sourceDecl of module.sourceDeclarations) {
        this.transpileSourceDeclaration(sourceDecl);
      }

      // Emit ingest source tasks
      for (const ingest of ingestDirectives) {
        this.emitIngestSourceTask(ingest);
      }

      // Execute primary expressions in order
      for (const primaryExpr of module.primaryExpressions) {
        const expr = this.transpileExpression(primaryExpr);
        this.emit(`await ${expr};`, primaryExpr.location);
      }

      if (module.runtimeDeclaration) {
        this.transpileRuntimeDeclaration(module.runtimeDeclaration);
        this.emit("if (__sourceTasks.length > 0) {");
        this.indent++;
        this.emit("await Promise.allSettled(__sourceTasks);");
        this.indent--;
        this.emit("}");
      }

      this.indent--;
      this.emit("})();");
    }

    // Emit test runner when the module contains test declarations
    if (module.testDeclarations.length > 0) {
      this.emit("");
      this.emit("// Test runner");
      this.emit("(async () => {");
      this.indent++;
      this.emit(
        "const __testResults: Array<{ name: string; passed: boolean; error?: string }> = [];",
      );

      for (const testDecl of module.testDeclarations) {
        this.transpileTestDeclaration(testDecl);
      }

      this.emit("");
      this.emit("const __passed = __testResults.filter(r => r.passed).length;");
      this.emit(
        "const __failed = __testResults.filter(r => !r.passed).length;",
      );
      this.emit("for (const __r of __testResults) {");
      this.indent++;
      // biome-ignore lint/suspicious/noTemplateCurlyInString: emitting source code that uses template literals
      this.emit("if (__r.passed) { console.log(`  ✓ ${__r.name}`); }");
      // biome-ignore lint/suspicious/noTemplateCurlyInString: emitting source code that uses template literals
      this.emit("else { console.log(`  ✗ ${__r.name}\\n    ${__r.error}`); }");
      this.indent--;
      this.emit("}");
      // biome-ignore lint/suspicious/noTemplateCurlyInString: emitting source code that uses template literals
      this.emit("console.log(`\\n${__passed} passed, ${__failed} failed`);");
      this.emit("if (__failed > 0) process.exit(1);");

      this.indent--;
      this.emit("})();");
    }

    return this.output.join("\n");
  }

  private transpileTestDeclaration(testDecl: AST.TestDeclaration): void {
    const label = JSON.stringify(testDecl.label);
    this.emit("");
    this.emit(`// Test: ${label}`);
    this.emit("{");
    this.indent++;
    this.emit(`try {`);
    this.indent++;
    this.emit("await (async () => {");
    this.indent++;
    for (const stmt of testDecl.body.statements) {
      if (stmt.type === "BindingDeclaration") {
        const val = this.transpileExpression(stmt.value);
        this.emit(`const ${stmt.name} = await ${val};`);
      } else {
        const expr = this.transpileExpression(stmt);
        this.emit(`await ${expr};`);
      }
    }
    this.indent--;
    this.emit("})();");
    this.indent--;
    this.emit(`__testResults.push({ name: ${label}, passed: true });`);
    this.emit(`} catch (__e: any) {`);
    this.indent++;
    this.emit(
      `__testResults.push({ name: ${label}, passed: false, error: __e?.message ?? String(__e) });`,
    );
    this.indent--;
    this.emit("}");
    this.indent--;
    this.emit("}");
  }

  private transpileImport(
    importDecl: AST.ImportDeclaration,
    currentFilePath?: string,
  ): void {
    const modulePath = importDecl.modulePath;

    // Check if it's a stdlib module or a file import
    const isStdlibModule =
      !modulePath.startsWith("./") &&
      !modulePath.startsWith("../") &&
      !path.isAbsolute(modulePath);

    if (isStdlibModule) {
      // Stdlib import - import from stdlib-runtime
      if (importDecl.alias) {
        // Qualified import: import * as alias from './stdlib-runtime'
        this.emit(`import * as ${importDecl.alias} from './stdlib-runtime';`);
      } else if (importDecl.imports) {
        // Selective import: import { fn1, fn2 } from './stdlib-runtime'
        const functions = importDecl.imports.join(", ");
        this.emit(`import { ${functions} } from './stdlib-runtime';`);
      } else {
        // Import all functions from a named stdlib module
        const stdlibModuleFunctions: Record<string, string[]> = {
          io: [
            "read_file",
            "write_file",
            "append_file",
            "file_exists",
            "delete_file",
            "list_dir",
            "make_dir",
            "read_lines",
            "write_lines",
            "path_join",
            "path_basename",
            "path_dirname",
            "path_ext",
            "watch_file",
            "read_records",
            "stdin_lines",
            "http_poll",
          ],
          process: [
            "exec",
            "exec_lines",
            "env_get",
            "env_get_or",
            "env_keys",
            "cwd",
            "exit_process",
          ],
          timer: ["sleep", "now", "timestamp", "elapsed", "format_date", "interval"],
          formats: ["infer_schema", "read_csv", "read_json"],
        };
        const knownFunctions = stdlibModuleFunctions[modulePath];
        if (knownFunctions) {
          this.emit(
            `import { ${knownFunctions.join(", ")} } from './stdlib-runtime';`,
          );
        }
        // For 'core' and unknown modules, the auto-import at the top already covers them
      }
    } else {
      // File import - resolve relative path and import from transpiled .ts file
      if (!currentFilePath) {
        // Can't resolve relative imports without knowing current file
        this.emit(
          `// WARNING: Cannot resolve relative import without current file path: ${modulePath}`,
        );
        return;
      }

      const currentDir = path.dirname(currentFilePath);
      const absolutePath = path.resolve(currentDir, modulePath);
      const relativePath = path.relative(
        path.dirname(currentFilePath),
        absolutePath,
      );

      // Remove .stm extension and ensure it starts with ./
      let importPath = relativePath.replace(/\.stm$/, "");
      if (!importPath.startsWith(".")) {
        importPath = "./" + importPath;
      }

      // Always emit a side-effect import so the module's IIFE (which registers
      // router handlers) executes even when no named symbols are used directly.
      this.emit(`import '${importPath}';`);

      if (importDecl.alias) {
        // Qualified import: import * as alias from './module'
        this.emit(`import * as ${importDecl.alias} from '${importPath}';`);
      } else if (importDecl.imports) {
        // Selective import: import { fn1, fn2 } from './module'
        const functions = importDecl.imports.join(", ");
        this.emit(`import { ${functions} } from '${importPath}';`);
      } else {
        // Full import: import all exported functions
        // We need to load the module to see what functions it exports
        try {
          const source = fs.readFileSync(absolutePath, "utf-8");
          const lexer = new Lexer(source);
          const tokens = lexer.tokenize();
          const parser = new Parser(tokens);
          const module = parser.parse();

          // Extract all function names
          const functions: string[] = [];
          for (const def of module.definitions) {
            if (def.type === "FunctionDeclaration") {
              functions.push(def.name);
            }
          }

          if (functions.length > 0) {
            this.emit(
              `import { ${functions.join(", ")} } from '${importPath}';`,
            );
          }
        } catch {
          // Fallback to namespace import if we can't parse the module
          this.emit(
            `import * as __imported_${path.basename(modulePath, ".stm")} from '${importPath}';`,
          );
        }
      }
    }
  }

  private transpileStructDeclaration(struct: AST.StructDeclaration): void {
    this.emit(`interface ${struct.name} {`, struct.location);
    this.indent++;
    for (const field of struct.fields) {
      this.emit(`${field.name}: ${this.mapTypeName(field.typeName)};`);
    }
    this.indent--;
    this.emit("}");
    this.emit("");
  }

  private transpileTypeDeclaration(typeDecl: AST.TypeDeclaration): void {
    const tsType = this.transpileTypeExpression(typeDecl.typeExpression);

    if (typeDecl.type === "TypeAliasDeclaration") {
      const typeParams =
        typeDecl.typeParams.length > 0
          ? `<${typeDecl.typeParams.join(", ")}>`
          : "";
      this.emit(`type ${typeDecl.name}${typeParams} = ${tsType};`, typeDecl.location);
      return;
    }

    this.emit(`type ${typeDecl.name} = ${tsType};`, typeDecl.location);
  }

  private transpileTypeExpression(typeExpr: AST.TypeExpression): string {
    switch (typeExpr.type) {
      case "NamedTypeExpression": {
        if (typeExpr.name === "List" && typeExpr.params.length === 1) {
          return `Array<${this.transpileTypeExpression(typeExpr.params[0])}>`;
        }

        const baseName = this.stroumTypeToTs(typeExpr.name);
        if (typeExpr.params.length === 0) {
          return baseName;
        }

        const params = typeExpr.params
          .map((p) => this.transpileTypeExpression(p))
          .join(", ");
        return `${baseName}<${params}>`;
      }
      case "FunctionTypeExpression": {
        const from = this.transpileTypeExpression(typeExpr.from);
        const to = this.transpileTypeExpression(typeExpr.to);
        return `(arg: ${from}) => ${to}`;
      }
      case "UnionTypeExpression": {
        return typeExpr.variants
          .map((variant) => {
            const payload = variant.payload
              ? this.transpileTypeExpression(variant.payload)
              : "null";
            return `{ outcome: ${JSON.stringify(variant.tag)}; value: ${payload} }`;
          })
          .join(" | ");
      }
      default:
        return "any";
    }
  }

  private routeMetaArg(): string {
    if (this.currentFn) {
      const argsObj = this.currentFn.params.map((p) => `${p}: ${p}`).join(", ");
      return `{ fn: ${JSON.stringify(this.currentFn.name)}, args: { ${argsObj} } }`;
    }
    return `{ fn: null, args: {} }`;
  }

  private stroumTypeToTs(t: string): string {
    switch (t) {
      case "Int":
      case "Float":
        return "number";
      case "String":
        return "string";
      case "Bool":
        return "boolean";
      case "Void":
        return "void";
      case "Fn":
        return "Function";
      case "Any":
        return "any";
      default:
        return t; // struct names, type vars — pass through
    }
  }

  private transpileFunctionDeclaration(func: AST.FunctionDeclaration): void {
    const params = func.params
      .map((p, i) => `${p}: ${this.stroumTypeToTs(func.paramTypes[i])}`)
      .join(", ");
    const retTs = this.stroumTypeToTs(func.returnType);
    const retAnnotation = retTs === "void" ? ": Promise<void>" : `: Promise<${retTs}>`;

    this.emit(`export async function ${func.name}(${params})${retAnnotation} {`, func.location);
    this.indent++;

    this.currentFn = { name: func.name, params: func.params };
    if (func.body.type === "IndentedBody") {
      this.transpileIndentedBody(func.body);
    } else {
      const expr = this.transpileExpression(func.body);
      this.emit(`return ${expr};`, func.body.location);
    }
    this.currentFn = null;

    this.indent--;
    this.emit("}");
    this.emit("");
  }

  private transpileBindingDeclaration(binding: AST.BindingDeclaration): void {
    const value = this.transpileExpression(binding.value);
    this.emit(`const ${binding.name} = ${value};`, binding.location);
  }

  private transpileIndentedBody(body: AST.IndentedBody): void {
    const stmts = body.statements;
    // Find the index of the last expression statement (the return value)
    let lastExprIdx = -1;
    for (let i = stmts.length - 1; i >= 0; i--) {
      if (stmts[i].type !== "BindingDeclaration") {
        lastExprIdx = i;
        break;
      }
    }
    for (let i = 0; i < stmts.length; i++) {
      const stmt = stmts[i];
      if (stmt.type === "BindingDeclaration") {
        this.transpileBindingDeclaration(stmt);
      } else if (i === lastExprIdx) {
        const expr = this.transpileExpression(stmt);
        this.emit(`return ${expr};`, stmt.location);
      } else {
        const expr = this.transpileExpression(stmt);
        this.emit(`await ${expr};`, stmt.location);
      }
    }
  }

  private transpileExpression(expr: AST.Expression): string {
    switch (expr.type) {
      case "Identifier":
        return expr.name;
      case "StreamSymbol":
        return JSON.stringify(expr.name);
      case "NumberLiteral":
        return expr.value.toString();
      case "StringLiteral":
        return JSON.stringify(expr.value);
      case "InterpolatedStringLiteral": {
        const parts = expr.segments.map((seg) => {
          if (seg.kind === "text") {
            // Escape backticks and literal ${ sequences in the text portion
            return seg.value
              .replace(/\\/g, "\\\\")
              .replace(/`/g, "\\`")
              .replace(/\$\{/g, "\\${");
          } else {
            return `\${${this.transpileExpression(seg.expression)}}`;
          }
        });
        return "`" + parts.join("") + "`";
      }
      case "BooleanLiteral":
        return expr.value.toString();
      case "ListLiteral":
        return this.transpileListLiteral(expr);
      case "RecordLiteral":
        return this.transpileRecordLiteral(expr);
      case "CallExpression":
        return this.transpileCallExpression(expr);
      case "FieldAccessExpression":
        return this.transpileFieldAccessExpression(expr);
      case "PipeExpression":
        return this.transpilePipeExpression(expr);
      case "ParallelExpression":
        return this.transpileParallelExpression(expr);
      case "Lambda":
        return this.transpileLambda(expr);
      case "IfExpression":
        return this.transpileIfExpression(expr);
      case "TaggedExpression":
        return this.transpileTaggedExpression(expr);
    }
  }

  private transpileListLiteral(list: AST.ListLiteral): string {
    const elements = list.elements.map((e) => this.transpileExpression(e));
    return `[${elements.join(", ")}]`;
  }

  private transpileRecordLiteral(record: AST.RecordLiteral): string {
    const fields = record.fields.map((f) => {
      const value = this.transpileExpression(f.value);
      return `${f.name}: ${value}`;
    });
    return `{ ${fields.join(", ")} }`;
  }

  private transpileCallExpression(call: AST.CallExpression): string {
    const args = call.args.map((a) => this.transpileExpression(a));
    return `await ${call.callee}(${args.join(", ")})`;
  }

  private transpileFieldAccessExpression(
    access: AST.FieldAccessExpression,
  ): string {
    const receiver = this.transpileExpression(access.receiver);
    if (access.dynamic) {
      return `(${receiver})["${access.field}"]`;
    }
    return `(${receiver}).${access.field}`;
  }

  private transpilePipeExpression(pipe: AST.PipeExpression): string {
    // Build a chain of awaited calls
    let result = "";

    if (pipe.stages.length === 0) {
      result = "undefined";
    } else if (pipe.stages.length === 1) {
      result = this.transpileExpression(pipe.stages[0]);
    } else {
      // Chain: stage[0] is the initial value; each subsequent stage threads the previous result
      result = this.transpileExpression(pipe.stages[0]);
      for (const stage of pipe.stages.slice(1)) {
        result = this.transpilePipeStage(stage, result);
      }
    }

    // Handle stream emit
    if (pipe.streamEmit) {
      // Emit to the first stream (Stroum supports multiple streams, we simplify to first)
      const streamArg = this.streamRefToTs(pipe.streamEmit.streams[0]);
      result = `__route(${result}, ${streamArg}, ${this.routeMetaArg()})`;
    }

    // Handle outcome matches
    if (pipe.outcomeMatches.length > 0) {
      result = `(async () => {
        let __value: any = ${result};
${pipe.outcomeMatches.map((m) => this.transpileOutcomeMatchInline(m)).join("\n")}
        return __value;
      })()`;
    }

    return result;
  }

  private transpileParallelExpression(
    parallel: AST.ParallelExpression,
  ): string {
    // Parallel: branch1 PP branch2 PP branch3 |> gather
    // Becomes: await gather(await Promise.all([branch1, branch2, branch3]))

    const branches = parallel.branches.map((b) => this.transpileExpression(b));
    const allPromises = `Promise.all([${branches.join(", ")}])`;

    let result: string;
    const gatherTarget = parallel.gatherPipe.target;

    if (gatherTarget.type === "Identifier") {
      result = `await ${gatherTarget.name}(await ${allPromises})`;
    } else if (gatherTarget.type === "CallExpression") {
      const args = gatherTarget.args.map((a) => this.transpileExpression(a));
      result = `await ${gatherTarget.callee}(await ${allPromises}${args.length > 0 ? ", " + args.join(", ") : ""})`;
    } else if (gatherTarget.type === "PipeExpression") {
      // The gather target is itself a pipe chain
      // We need to pass the parallel results as the first value
      result = this.transpilePipeChainWithInitialValue(
        gatherTarget,
        `await ${allPromises}`,
      );
    } else {
      result = `(${this.transpileExpression(gatherTarget)})(await ${allPromises})`;
    }

    // Handle stream emit on gather pipe
    if (parallel.gatherPipe.streamEmit) {
      const streamArg = this.streamRefToTs(
        parallel.gatherPipe.streamEmit.streams[0],
      );
      result = `__route(${result}, ${streamArg}, ${this.routeMetaArg()})`;
    }

    return result;
  }

  private transpilePipeChainWithInitialValue(
    pipe: AST.PipeExpression,
    initialValue: string,
  ): string {
    // Build a chain of awaited calls, starting with initialValue.
    // Every stage threads the piped value (bare name or _ placeholder).
    let result = initialValue;
    for (const stage of pipe.stages) {
      result = this.transpilePipeStage(stage, result);
    }

    // Handle stream emit
    if (pipe.streamEmit) {
      const streamArg = this.streamRefToTs(pipe.streamEmit.streams[0]);
      result = `__route(${result}, ${streamArg}, ${this.routeMetaArg()})`;
    }

    // Handle outcome matches
    if (pipe.outcomeMatches.length > 0) {
      result = `(async () => {
        let __value: any = ${result};
${pipe.outcomeMatches.map((m) => this.transpileOutcomeMatchInline(m)).join("\n")}
        return __value;
      })()`;
    }

    return result;
  }

  // Transpile a single pipe stage, always threading the piped value.
  // Two forms:
  //   bare identifier f       → await f(pipedValue)
  //   call with _ placeholder → await f(...args, _ replaced by pipedValue)
  // A CallExpression with args but no _ is a compile error (caught by the validator).
  private transpilePipeStage(
    stage: AST.Expression,
    pipedValue: string,
  ): string {
    if (stage.type === "CallExpression") {
      const hasPlaceholder = stage.args.some(
        (a) => a.type === "Identifier" && a.name === "_",
      );
      if (hasPlaceholder) {
        const args = stage.args.map((a) =>
          a.type === "Identifier" && a.name === "_"
            ? pipedValue
            : this.transpileExpression(a),
        );
        return `await ${stage.callee}(${args.join(", ")})`;
      } else {
        // No _ placeholder — the validator should have flagged this.
        // As a fallback, throw here to surface the issue clearly.
        throw new Error(
          `[stroum] pipe stage '${stage.callee}(...)' has arguments but no '_' placeholder. ` +
            `Use '${stage.callee}(_, ...)' to thread the piped value, or just '${stage.callee}' to pass it as the sole argument.`,
        );
      }
    } else if (stage.type === "Identifier") {
      // Bare name: pass piped value as sole argument
      return `await ${stage.name}(${pipedValue})`;
    } else {
      return `await (${this.transpileExpression(stage)})(${pipedValue})`;
    }
  }

  // Convert a StreamRef to a TypeScript stream key.
  private streamRefToTs(ref: AST.StreamRef): string {
    return JSON.stringify(ref.name);
  }

  private transpileLambda(lambda: AST.Lambda): string {
    const params = lambda.params
      .map((p, i) => `${p}: ${this.stroumTypeToTs(lambda.paramTypes[i])}`)
      .join(", ");
    const body = this.transpileExpression(lambda.body);
    return `async (${params}) => ${body}`;
  }

  private transpileTaggedExpression(expr: AST.TaggedExpression): string {
    const value = this.transpileExpression(expr.value);
    return `{ outcome: ${JSON.stringify(expr.tag.name)}, value: ${value} }`;
  }

  private tagRefToTs(ref: AST.TagRef): string {
    return JSON.stringify(ref.name);
  }

  // Transpile an outcome match handler, calling it with the inner unwrapped value.
  // Bare identifier: await fn(inner)
  // Call with _:   await fn(inner, other)
  // Call without _: await fn(args)  — explicitly ignores the inner value
  // Other (lambda): await (expr)(inner)
  private transpileOutcomeHandler(
    handler: AST.Expression,
    innerVar: string,
  ): string {
    if (handler.type === "Identifier") {
      return `await ${handler.name}(${innerVar})`;
    } else if (handler.type === "CallExpression") {
      const hasPlaceholder = handler.args.some(
        (a) => a.type === "Identifier" && a.name === "_",
      );
      if (hasPlaceholder) {
        const args = handler.args.map((a) =>
          a.type === "Identifier" && a.name === "_"
            ? innerVar
            : this.transpileExpression(a),
        );
        return `await ${handler.callee}(${args.join(", ")})`;
      } else {
        // Call as-is — handler doesn't use the inner value
        const args = handler.args.map((a) => this.transpileExpression(a));
        return `await ${handler.callee}(${args.length > 0 ? args.join(", ") : ""})`;
      }
    } else if (handler.type === "PipeExpression") {
      // If the pipe starts with a lambda, thread the inner value through it (lambda acts as handler fn).
      // Otherwise treat as a standalone expression (inner value not used).
      if (handler.stages.length > 0 && handler.stages[0].type === "Lambda") {
        return `await (${this.transpilePipeChainWithInitialValue(handler, innerVar)})`;
      }
      return `await (${this.transpileExpression(handler)})`;
    } else {
      // Lambda or other expression — call with inner value
      return `await (${this.transpileExpression(handler)})(${innerVar})`;
    }
  }

  private transpileIfExpression(ifExpr: AST.IfExpression): string {
    const condition = this.transpileExpression(ifExpr.condition);
    const thenBranch = this.transpileExpression(ifExpr.thenBranch);
    const elseBranch = this.transpileExpression(ifExpr.elseBranch);

    // Use an IIFE to handle async operations in branches
    return `(await (async () => (${condition}) ? (${thenBranch}) : (${elseBranch}))())`;
  }

  private transpileOutcomeMatchInline(match: AST.OutcomeMatch): string {
    const tagComparison = this.tagRefToTs(match.tag);
    let handler: string;

    if (
      match.handler.type === "Identifier" &&
      match.handler.name === "__outcome_value__"
    ) {
      // Passthrough: | .tag => @"stream" — route/pass the inner value directly
      if (match.streamEmit) {
        const streamArg = this.streamRefToTs(match.streamEmit.streams[0]);
        handler = `await __route(__inner, ${streamArg}, ${this.routeMetaArg()})`;
      } else {
        handler = "__inner";
      }
    } else {
      handler = this.transpileOutcomeHandler(match.handler, "__inner");
      if (match.streamEmit) {
        const streamArg = this.streamRefToTs(match.streamEmit.streams[0]);
        handler = `await __route(${handler}, ${streamArg}, ${this.routeMetaArg()})`;
      }
    }

    return `        if (__value && typeof __value === 'object' && __value.outcome === ${tagComparison}) {
          const __inner = __value.value;
          __value = ${handler};
        }`;
  }

  private transpileOnHandler(handler: AST.OnHandler): void {
    // Handler.handler is a Lambda, we need to transpile it
    const handlerExpr = this.transpileLambda(handler.handler);
    this.emit(`__router.on(${this.streamRefToTs(handler.streamPattern)}, ${handlerExpr});`);
  }

  private transpileSourceDeclaration(sourceDecl: AST.SourceDeclaration): void {
    const streamArg = this.streamRefToTs(sourceDecl.stream);

    if (
      sourceDecl.source.type === "CallExpression" &&
      this.isCallbackSource(sourceDecl.source.callee)
    ) {
      const args = sourceDecl.source.args.map((a) =>
        this.transpileExpression(a),
      );
      this.emit(
        `__sourceTasks.push(${sourceDecl.source.callee}(${args.join(", ")}${args.length > 0 ? ", " : ""}async (__sourceValue) => { await __route(__sourceValue, ${streamArg}, { fn: null, args: {} }); }, __runtimeControl.signal));`,
      );
      return;
    }

    const sourceExpr = this.transpileExpression(sourceDecl.source);
    this.emit(
      `await __route(${sourceExpr}, ${streamArg}, { fn: null, args: {} });`,
    );
  }

  private transpileWireDeclaration(wire: AST.WireDeclaration): void {
    const from = this.streamRefToTs(wire.from);
    const to = this.streamRefToTs(wire.to);
    this.emit(
      `__router.on(${from}, async (__wireValue) => { await __route(__wireValue, ${to}, { fn: null, args: {} }); });`,
    );
  }

  private transpileSinkDeclaration(sinkDecl: AST.SinkDeclaration): void {
    const streamArg = this.streamRefToTs(sinkDecl.stream);
    const handlerBody = this.transpileSinkHandler(sinkDecl.sink, "__sinkValue");
    this.emit(
      `__router.on(${streamArg}, async (__sinkValue) => { await ${handlerBody}; });`,
    );
  }

  private transpileSinkHandler(sink: AST.Expression, valueVar: string): string {
    if (sink.type === "Identifier") {
      return `${sink.name}(${valueVar})`;
    }

    if (sink.type === "CallExpression" && this.isSinkFactory(sink.callee)) {
      const args = sink.args.map((a) => this.transpileExpression(a));
      return `(${sink.callee}(${args.join(", ")}))(${valueVar})`;
    }

    if (sink.type === "CallExpression") {
      const hasPlaceholder = sink.args.some(
        (a) => a.type === "Identifier" && a.name === "_",
      );
      if (hasPlaceholder) {
        const args = sink.args.map((a) =>
          a.type === "Identifier" && a.name === "_"
            ? valueVar
            : this.transpileExpression(a),
        );
        return `${sink.callee}(${args.join(", ")})`;
      }

      const args = [
        valueVar,
        ...sink.args.map((a) => this.transpileExpression(a)),
      ];
      return `${sink.callee}(${args.join(", ")})`;
    }

    if (sink.type === "PipeExpression") {
      return `(${this.transpilePipeChainWithInitialValue(sink, valueVar)})`;
    }

    return `(${this.transpileExpression(sink)})(${valueVar})`;
  }

  private transpileRuntimeDeclaration(
    runtimeDecl: AST.RuntimeDeclaration,
  ): void {
    if (runtimeDecl.type === "RunForeverDeclaration") {
      this.emit("await __runForever();");
      return;
    }

    switch (runtimeDecl.condition.type) {
      case "SignalCondition":
        this.emit("await __runUntilSignal();");
        return;
      case "StreamCondition":
        this.emit(
          `await __runUntilStream(${this.streamRefToTs(runtimeDecl.condition.stream)});`,
        );
        return;
      case "TimeoutCondition":
        this.emit(
          `await __runUntilTimeout(${this.transpileTimeoutDuration(runtimeDecl.condition.duration)});`,
        );
        return;
    }
  }

  private transpileTimeoutDuration(duration: AST.Expression): string {
    if (
      duration.type === "CallExpression" &&
      duration.callee === "timeout" &&
      duration.args.length === 1
    ) {
      return this.transpileExpression(duration.args[0]);
    }

    return this.transpileExpression(duration);
  }

  private isCallbackSource(callee: string): boolean {
    return new Set(["watch_file", "read_records", "from_list", "interval", "stdin_lines", "http_poll"]).has(callee);
  }

  private isSinkFactory(callee: string): boolean {
    return new Set(["file_sink", "jsonl_sink", "log_sink", "http_sink"]).has(
      callee,
    );
  }

  private transpileRouteDeclaration(route: AST.RouteDeclaration): void {
    // route @"stream" |> op1 |> op2
    // Registers the pipeline as the continuation handler.
    // The emitted value is piped as the first argument to the pipeline.
    const pipeline = route.pipeline;
    let handlerBody: string;

    if (pipeline.type === "PipeExpression") {
      handlerBody = this.transpilePipeChainWithInitialValue(
        pipeline,
        "__routeValue",
      );
    } else if (pipeline.type === "Identifier") {
      handlerBody = `await ${pipeline.name}(__routeValue)`;
    } else if (pipeline.type === "CallExpression") {
      const args = pipeline.args.map((a) => this.transpileExpression(a));
      handlerBody = `await ${pipeline.callee}(__routeValue${args.length > 0 ? ", " + args.join(", ") : ""})`;
    } else {
      handlerBody = this.transpileExpression(pipeline);
    }

    this.emit(
      `__router.on(${this.streamRefToTs(route.streamPattern)}, async (__routeValue) => { await ${handlerBody}; });`,
    );
  }

  private mapTypeName(typeName: string): string {
    // Map Stroum type names to TypeScript types
    const typeMap: Record<string, string> = {
      String: "string",
      Int: "number",
      Float: "number",
      Bool: "boolean",
      List: "any[]",
    };
    return typeMap[typeName] || typeName;
  }

  private emit(line: string, loc?: SourceLocation): void {
    const indentation = "  ".repeat(this.indent);
    this.output.push(indentation + line);
    if (loc) {
      this.srcMappings.push({ genLine: this.genLineCount, srcLine: loc.line, srcCol: loc.column });
    }
    this.genLineCount++;
  }

  buildSourceMap(sourceFile: string, generatedFile: string): string {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { SourceMapGenerator } = require("source-map") as typeof import("source-map");
    const gen = new SourceMapGenerator({ file: path.basename(generatedFile) });
    const sourceName = path.relative(path.dirname(generatedFile), sourceFile);
    for (const m of this.srcMappings) {
      gen.addMapping({
        generated: { line: m.genLine, column: 0 },
        source: sourceName,
        original: { line: m.srcLine, column: m.srcCol - 1 },
      });
    }
    return gen.toString();
  }

  private emitIngestSourceTask(ingest: IngestDirectiveData): void {
    const filePath = JSON.stringify(ingest.absoluteFilePath);
    const sep = JSON.stringify(ingest.separator);
    const count = ingest.expectedFieldCount;
    const successStream = JSON.stringify(ingest.successStream);
    const failStream = JSON.stringify(ingest.failStream);

    this.emit(`await (async () => {`);
    this.indent++;
    this.emit(`const __content = __fs.readFileSync(${filePath}, "utf-8");`);
    this.emit(
      `const __lines = __content.split("\\n").map((l: string) => l.trim()).filter((l: string) => l.length > 0);`,
    );
    this.emit(`let __lineNum = 0;`);
    this.emit(`for (const __line of __lines) {`);
    this.indent++;
    this.emit(`__lineNum++;`);
    this.emit(`const __parts = __line.split(${sep}).map((f: string) => f.trim());`);
    this.emit(`if (__parts.length !== ${count}) {`);
    this.indent++;
    this.emit(
      `await __router.emit(${failStream}, { row: __line, line_number: __lineNum, error: "field count mismatch: expected ${count}, got " + __parts.length, raw: __parts });`,
    );
    this.emit(`continue;`);
    this.indent--;
    this.emit(`}`);

    // Per-field type coercions for non-String fields
    const coercedVars: string[] = [];
    for (let i = 0; i < ingest.fields.length; i++) {
      const field = ingest.fields[i];
      if (field.type === "Int") {
        this.emit(`const __f${i} = parseInt(__parts[${i}], 10);`);
        this.emit(`if (isNaN(__f${i})) {`);
        this.indent++;
        this.emit(
          `await __router.emit(${failStream}, { row: __line, line_number: __lineNum, error: "type mismatch at ${field.name}: expected Int", raw: __parts });`,
        );
        this.emit(`continue;`);
        this.indent--;
        this.emit(`}`);
        coercedVars.push(`${field.name}: __f${i}`);
      } else if (field.type === "Float") {
        this.emit(`const __f${i} = parseFloat(__parts[${i}]);`);
        this.emit(`if (isNaN(__f${i})) {`);
        this.indent++;
        this.emit(
          `await __router.emit(${failStream}, { row: __line, line_number: __lineNum, error: "type mismatch at ${field.name}: expected Float", raw: __parts });`,
        );
        this.emit(`continue;`);
        this.indent--;
        this.emit(`}`);
        coercedVars.push(`${field.name}: __f${i}`);
      } else if (field.type === "Bool") {
        this.emit(`const __f${i} = __parts[${i}].toLowerCase();`);
        this.emit(`if (__f${i} !== "true" && __f${i} !== "false") {`);
        this.indent++;
        this.emit(
          `await __router.emit(${failStream}, { row: __line, line_number: __lineNum, error: "type mismatch at ${field.name}: expected Bool", raw: __parts });`,
        );
        this.emit(`continue;`);
        this.indent--;
        this.emit(`}`);
        coercedVars.push(`${field.name}: __f${i} === "true"`);
      } else {
        coercedVars.push(`${field.name}: __parts[${i}]`);
      }
    }

    if (ingest.validateRules && ingest.validateFailStream) {
      const validateFail = JSON.stringify(ingest.validateFailStream);
      // Destructure field values so the rule expression can reference them by name
      const fieldNames = ingest.fields.map((f) => f.name).join(", ");
      this.emit(`const { ${fieldNames} } = { ${coercedVars.join(", ")} };`);
      this.emit(`if (!(${ingest.validateRules})) {`);
      this.indent++;
      this.emit(
        `await __router.emit(${validateFail}, { row: __line, line_number: __lineNum, error: "validation failed", raw: __parts });`,
      );
      this.emit(`continue;`);
      this.indent--;
      this.emit(`}`);
      this.emit(`await __router.emit(${successStream}, { ${fieldNames} });`);
    } else {
      this.emit(`await __router.emit(${successStream}, { ${coercedVars.join(", ")} });`);
    }
    this.indent--;
    this.emit(`}`);
    this.indent--;
    this.emit(`})();`);
  }

  transpileWithMap(
    module: AST.Module,
    sourcePath: string,
    generatedPath: string,
    ingestDirectives: IngestDirectiveData[] = [],
  ): { code: string; map: string } {
    const code = this.transpile(module, sourcePath, ingestDirectives);
    const map = this.buildSourceMap(sourcePath, generatedPath);
    const mapFile = `${path.basename(generatedPath)}.map`;
    return { code: `${code}\n//# sourceMappingURL=${mapFile}`, map };
  }

  // Generate the runtime file alongside the output
  static emitRuntime(outputDir: string): void {
    const runtimeTemplatePath = path.join(__dirname, "runtime-template.ts");
    const runtimeOutputPath = path.join(outputDir, "stroum-runtime.ts");

    const runtimeContent = fs.readFileSync(runtimeTemplatePath, "utf-8");
    fs.writeFileSync(runtimeOutputPath, runtimeContent);

    // Also emit stdlib-runtime.ts
    const stdlibRuntimePath = path.join(
      __dirname,
      "..",
      "stdlib",
      "stdlib-runtime.ts",
    );
    const stdlibOutputPath = path.join(outputDir, "stdlib-runtime.ts");

    if (fs.existsSync(stdlibRuntimePath)) {
      const stdlibContent = fs.readFileSync(stdlibRuntimePath, "utf-8");
      fs.writeFileSync(stdlibOutputPath, stdlibContent);
    }
  }
}
