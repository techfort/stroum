import type * as AST from "./ast";
import { ModuleResolver } from "./module-resolver";
import { StdlibLoader } from "./stdlib-loader";
import type { SourceLocation } from "./types";

export interface ValidationError {
  type: "error";
  message: string;
  location: SourceLocation;
}

export interface ValidationWarning {
  type: "warning";
  message: string;
  location: SourceLocation;
}

export type ValidationIssue = ValidationError | ValidationWarning;

interface ImportedScope {
  modulePath: string;
  functions: Set<string>; // Available function names
  arities: Map<string, number>; // arity per function (user imports only)
  alias: string | null; // For qualified access
}

export class Validator {
  private errors: ValidationError[] = [];
  private warnings: ValidationWarning[] = [];
  private moduleBindings: Set<string> = new Set();
  private functionArities: Map<string, number> = new Map();
  private currentScope: Set<string> = new Set();
  private declaredStreams: Set<string> = new Set();
  private currentFunctionName: string | null = null;
  private stdlibLoader: StdlibLoader;
  private moduleResolver: ModuleResolver;
  private imports: ImportedScope[] = [];
  private currentFilePath: string = "";

  constructor(stdlibPath?: string) {
    this.stdlibLoader = new StdlibLoader(stdlibPath);
    this.moduleResolver = new ModuleResolver(stdlibPath);
  }

  validate(module: AST.Module, filePath?: string): ValidationIssue[] {
    this.errors = [];
    this.warnings = [];
    this.moduleBindings.clear();
    this.functionArities.clear();
    this.currentScope.clear();
    this.declaredStreams.clear();
    this.imports = [];
    this.currentFilePath = filePath || "";

    // Process imports
    for (const importDecl of module.imports) {
      this.processImport(importDecl);
    }

    // First pass: collect all module-level bindings and arities
    for (const def of module.definitions) {
      if (def.type === "FunctionDeclaration") {
        this.addModuleBinding(def.name, def.location);
        this.functionArities.set(def.name, def.params.length);
      } else if (def.type === "BindingDeclaration") {
        this.addModuleBinding(def.name, def.location);
      }
      // Struct names are types, not bindings
    }

    // Second pass: validate each definition
    for (const def of module.definitions) {
      this.validateDefinition(def);
    }

    // Validate stream declarations
    for (const streamDecl of module.streamDeclarations) {
      this.validateStreamDeclaration(streamDecl);
    }

    // Validate source declarations
    for (const sourceDecl of module.sourceDeclarations) {
      this.validateSourceDeclaration(sourceDecl);
    }

    // Validate sink declarations
    for (const sinkDecl of module.sinkDeclarations) {
      this.validateSinkDeclaration(sinkDecl);
    }

    // Validate test declarations
    for (const testDecl of module.testDeclarations) {
      this.validateTestDeclaration(testDecl);
    }

    // Validate primary expressions
    for (const primaryExpr of module.primaryExpressions) {
      this.validateExpression(primaryExpr);
    }

    // Validate contingencies
    for (const contingency of module.contingencies) {
      this.validateContingency(contingency);
    }

    if (
      this.hasOpenEndedSource(module.sourceDeclarations) &&
      !module.runtimeDeclaration
    ) {
      const location =
        module.sourceDeclarations[0]?.location ?? module.location;
      this.addWarning(
        "Program declares open-ended src: sources but has no run until declaration",
        location,
      );
    }

    return [...this.errors, ...this.warnings];
  }

  private validateStreamDeclaration(decl: AST.StreamDeclaration): void {
    if (this.declaredStreams.has(decl.name)) {
      this.addError(`Duplicate stream declaration: '${decl.name}'`, decl.location);
    } else {
      this.declaredStreams.add(decl.name);
    }
  }

  private validateSourceDeclaration(sourceDecl: AST.SourceDeclaration): void {
    this.validateExpression(sourceDecl.source);
  }

  private validateSinkDeclaration(sinkDecl: AST.SinkDeclaration): void {
    this.validateExpression(sinkDecl.sink);
  }

  private validateTestDeclaration(testDecl: AST.TestDeclaration): void {
    const saved = this.currentScope;
    this.currentScope = new Set(saved);
    for (const stmt of testDecl.body.statements) {
      if (stmt.type === "BindingDeclaration") {
        this.validateExpression(stmt.value);
        this.currentScope.add(stmt.name);
      } else {
        this.validateExpression(stmt);
      }
    }
    this.currentScope = saved;
  }

  private hasOpenEndedSource(
    sourceDeclarations: AST.SourceDeclaration[],
  ): boolean {
    return sourceDeclarations.some((sourceDecl) =>
      this.isOpenEndedSource(sourceDecl.source),
    );
  }

  private isOpenEndedSource(source: AST.Expression): boolean {
    if (source.type !== "CallExpression") {
      return false;
    }

    return new Set([
      "watch_file",
      "watch_dir",
      "interval",
      "stdin_lines",
      "http_poll",
      "http_server",
      "kafka",
      "timer",
      "cron",
      "websocket",
      "redis_stream",
    ]).has(source.callee);
  }

  private isStdlibModule(modulePath: string): boolean {
    return new Set(["core", "io", "timer", "process", "formats"]).has(modulePath);
  }

  private processImport(importDecl: AST.ImportDeclaration): void {
    try {
      const resolvedPath = this.moduleResolver.resolveModulePath(
        importDecl.modulePath,
        this.currentFilePath,
      );

      const resolved = this.moduleResolver.loadModule(resolvedPath);
      const functions = new Set<string>();
      // Collect arities for user imports only; stdlib may have TS-level overloads
      const arities = new Map<string, number>();
      const trackArities = !this.isStdlibModule(importDecl.modulePath);

      // If selective imports, only add those functions
      if (importDecl.imports) {
        for (const funcName of importDecl.imports) {
          const decl = resolved.module.definitions.find(
            (def) =>
              def.type === "FunctionDeclaration" && def.name === funcName,
          ) as AST.FunctionDeclaration | undefined;
          if (!decl) {
            this.addError(
              `Function '${funcName}' not found in module '${importDecl.modulePath}'`,
              importDecl.location,
            );
          } else {
            functions.add(funcName);
            if (trackArities) arities.set(funcName, decl.params.length);
          }
        }
      } else {
        // Import all functions from the module
        for (const def of resolved.module.definitions) {
          if (def.type === "FunctionDeclaration") {
            functions.add(def.name);
            if (trackArities) arities.set(def.name, def.params.length);
          }
        }
      }

      this.imports.push({
        modulePath: importDecl.modulePath,
        functions,
        arities,
        alias: importDecl.alias,
      });
    } catch (error) {
      this.addError(
        `Failed to resolve import: ${error instanceof Error ? error.message : String(error)}`,
        importDecl.location,
      );
    }
  }

  private getExpectedArity(name: string): number | null {
    // Skip builtins — TypeScript-level, arity not tracked in Stroum
    if (name.startsWith("__builtin_") || name.startsWith("__formats_")) return null;

    // Local user-defined functions
    const local = this.functionArities.get(name);
    if (local !== undefined) return local;

    // User-imported module functions (non-stdlib only)
    for (const imported of this.imports) {
      const importedArity = imported.arities.get(name);
      if (!imported.alias && importedArity !== undefined) return importedArity;
    }

    // Unknown (stdlib or unresolved) — don't check
    return null;
  }

  private isFunctionAvailable(name: string): boolean {
    // __builtin_* names are TypeScript-level primitives, always available
    if (name.startsWith("__builtin_")) {
      return true;
    }

    // __formats_* names are format-specific primitives, always available
    if (name.startsWith("__formats_")) {
      return true;
    }

    // Check local module bindings
    if (this.moduleBindings.has(name)) {
      return true;
    }

    // Check current scope (parameters)
    if (this.currentScope.has(name)) {
      return true;
    }

    // Check imported functions (direct imports)
    for (const imported of this.imports) {
      if (!imported.alias && imported.functions.has(name)) {
        return true;
      }
    }

    // Check stdlib (always auto-imported)
    if (this.stdlibLoader.hasFunction(name)) {
      return true;
    }

    return false;
  }

  private isQualifiedFunctionAvailable(
    alias: string,
    funcName: string,
  ): boolean {
    // Check imports with matching alias
    for (const imported of this.imports) {
      if (imported.alias === alias && imported.functions.has(funcName)) {
        return true;
      }
    }
    return false;
  }

  private addModuleBinding(name: string, location: SourceLocation): void {
    if (this.moduleBindings.has(name)) {
      this.addError(
        `Duplicate binding name: '${name}' already defined at module level`,
        location,
      );
    } else {
      this.moduleBindings.add(name);
    }
  }

  private addError(message: string, location: SourceLocation): void {
    this.errors.push({ type: "error", message, location });
  }

  private addWarning(message: string, location: SourceLocation): void {
    this.warnings.push({ type: "warning", message, location });
  }

  private validateDefinition(def: AST.Declaration): void {
    switch (def.type) {
      case "FunctionDeclaration":
        this.validateFunctionDeclaration(def);
        break;
      case "BindingDeclaration":
        this.validateBindingDeclaration(def);
        break;
      case "StructDeclaration":
        this.validateStructDeclaration(def);
        break;
    }
  }

  private validateFunctionDeclaration(func: AST.FunctionDeclaration): void {
    const previousScope = new Set(this.currentScope);
    const previousFunctionName = this.currentFunctionName;
    this.currentScope.clear();
    this.currentFunctionName = func.name;

    // Enforce mandatory types
    if (func.paramTypes.length !== func.params.length) {
      this.addError(
        `Function '${func.name}': paramTypes length does not match params length (parser error)`,
        func.location,
      );
    }

    // Add function parameters to scope
    for (const param of func.params) {
      if (this.currentScope.has(param)) {
        this.addError(`Duplicate parameter name: '${param}'`, func.location);
      } else {
        this.currentScope.add(param);
      }
    }

    // Validate emission contract
    if (func.emissionContract) {
      for (const stream of func.emissionContract) {
        if (!this.isStringLiteral(stream)) {
          this.addError(
            `Stream name in emission contract must be a string literal, got: '${stream}'`,
            func.location,
          );
        }
      }
    }

    // Check for rec usage
    if (func.isRecursive) {
      const usesRecursion = this.checkForSelfReference(func.body, func.name);
      if (!usesRecursion) {
        this.addWarning(
          `Function '${func.name}' is marked as 'rec' but does not reference itself`,
          func.location,
        );
      }
    }

    // Check for multiple outcome paths without emission contract
    if (!func.emissionContract) {
      const outcomeCount = this.countOutcomePaths(func.body);
      if (outcomeCount > 1) {
        this.addWarning(
          `Function '${func.name}' has ${outcomeCount} outcome paths but no emission contract (~>)`,
          func.location,
        );
      }
    }

    // Validate function body
    this.validateBody(func.body);

    // Restore scope
    this.currentScope = previousScope;
    this.currentFunctionName = previousFunctionName;
  }

  private validateBindingDeclaration(binding: AST.BindingDeclaration): void {
    this.validateExpression(binding.value);
  }

  private validateStructDeclaration(struct: AST.StructDeclaration): void {
    const fieldNames = new Set<string>();
    for (const field of struct.fields) {
      if (fieldNames.has(field.name)) {
        this.addError(
          `Duplicate field name: '${field.name}' in struct '${struct.name}'`,
          struct.location,
        );
      } else {
        fieldNames.add(field.name);
      }
    }
  }

  private validateBody(body: AST.Expression | AST.IndentedBody): void {
    if (body.type === "IndentedBody") {
      const saved = this.currentScope;
      this.currentScope = new Set(saved);
      for (const stmt of body.statements) {
        if (stmt.type === "BindingDeclaration") {
          this.validateBindingDeclaration(stmt);
          this.currentScope.add(stmt.name);
        } else {
          this.validateExpression(stmt);
        }
      }
      this.currentScope = saved;
    } else {
      this.validateExpression(body);
    }
  }

  private validateExpression(expr: AST.Expression): void {
    switch (expr.type) {
      case "Identifier": {
        // Check if identifier is available (local binding, parameter, import, or stdlib)
        const name = expr.name;
        // `_` is the pipe placeholder; `__outcome_value__` and `__builtin_*` are synthetic
        if (
          name === "_" ||
          name === "__outcome_value__" ||
          name.startsWith("__builtin_")
        )
          break;
        const isImportAlias = this.imports.some((imp) => imp.alias === name);
        if (
          !isImportAlias &&
          !this.isFunctionAvailable(name) &&
          name !== this.currentFunctionName
        ) {
          this.addError(
            `Undefined identifier: '${name}'. ` +
              `It is not defined as a binding, function, parameter, or import.`,
            expr.location,
          );
        }
        break;
      }
      case "NumberLiteral":
      case "StringLiteral":
      case "BooleanLiteral":
      case "StreamSymbol":
        break;
      case "InterpolatedStringLiteral":
        for (const seg of expr.segments) {
          if (seg.kind === "expr") {
            this.validateExpression(seg.expression);
          }
        }
        break;
      case "ListLiteral":
        for (const elem of expr.elements) {
          this.validateExpression(elem);
        }
        if (expr.elementType) {
          for (const elem of expr.elements) {
            const mismatch = this.checkElementType(elem, expr.elementType);
            if (mismatch) {
              this.addError(
                `Type mismatch in ${expr.elementType}[]: expected ${expr.elementType}, got ${mismatch}`,
                elem.location,
              );
            }
          }
        }
        break;
      case "RecordLiteral":
        for (const field of expr.fields) {
          this.validateExpression(field.value);
        }
        break;
      case "CallExpression": {
        // Validate function call - check if function exists
        const callee = expr.callee;

        // Check for qualified calls (alias.function)
        if (callee.includes(".")) {
          const [alias, funcName] = callee.split(".");
          if (!this.isQualifiedFunctionAvailable(alias, funcName)) {
            this.addError(
              `Undefined qualified function: '${callee}'. ` +
                `Check that '${alias}' is imported with an alias and contains function '${funcName}'.`,
              expr.location,
            );
          }
        } else {
          // Direct function call
          if (!this.isFunctionAvailable(callee)) {
            this.addError(
              `Undefined function: '${callee}'. ` +
                `Function is not defined locally, imported, or available in stdlib.`,
              expr.location,
            );
          }

          // Arity check (user-defined and user-imported functions only)
          const expectedArity = this.getExpectedArity(callee);
          if (expectedArity !== null && expr.args.length !== expectedArity) {
            this.addError(
              `Function '${callee}' expects ${expectedArity} argument${expectedArity === 1 ? "" : "s"} but got ${expr.args.length}`,
              expr.location,
            );
          }
        }

        // Validate arguments
        for (const arg of expr.args) {
          this.validateExpression(arg);
        }
        break;
      }
      case "FieldAccessExpression":
        this.validateExpression(expr.receiver);
        break;
      case "PipeExpression":
        // stage[0] is the initial value; stages[1..n] must thread the piped value.
        // A CallExpression with args but no _ is an error in a piped stage.
        for (let i = 0; i < expr.stages.length; i++) {
          const stage = expr.stages[i];
          if (i > 0 && stage.type === "CallExpression") {
            const hasPlaceholder = (stage as AST.CallExpression).args.some(
              (a) =>
                a.type === "Identifier" && (a as AST.Identifier).name === "_",
            );
            if (
              !hasPlaceholder &&
              (stage as AST.CallExpression).args.length > 0
            ) {
              this.addError(
                `Pipe stage '${(stage as AST.CallExpression).callee}(...)' has arguments but no '_' placeholder. ` +
                  `Use '_' to mark where the piped value goes (e.g. '${(stage as AST.CallExpression).callee}(_, ...)'), ` +
                  `or write just '${(stage as AST.CallExpression).callee}' to pass the piped value as the sole argument. ` +
                  `To call '${(stage as AST.CallExpression).callee}' independently, write it as a separate statement.`,
                stage.location,
              );
            }
          }
          this.validateExpression(stage);
        }
        for (const match of expr.outcomeMatches) {
          this.validateOutcomeMatch(match);
        }
        break;
      case "ParallelExpression":
        for (const branch of expr.branches) {
          this.validateExpression(branch);
        }
        this.validateExpression(expr.gatherPipe.target);
        break;
      case "Lambda":
        this.validateLambda(expr);
        break;
      case "IfExpression":
        // Validate condition and both branches
        this.validateExpression(expr.condition);
        this.validateExpression(expr.thenBranch);
        this.validateExpression(expr.elseBranch);
        break;
      case "TaggedExpression":
        this.validateExpression(expr.value);
        break;
    }
  }

  private validateLambda(lambda: AST.Lambda): void {
    const previousScope = new Set(this.currentScope);

    // Check for duplicate lambda parameters (shadowing parent scope is allowed)
    const lambdaParams = new Set<string>();
    for (const param of lambda.params) {
      if (lambdaParams.has(param)) {
        this.addError(
          `Duplicate parameter name: '${param}' in lambda`,
          lambda.location,
        );
      }
      lambdaParams.add(param);
      this.currentScope.add(param);
    }

    this.validateExpression(lambda.body);

    // Restore scope
    this.currentScope = previousScope;
  }

  private validateOutcomeMatch(match: AST.OutcomeMatch): void {
    this.validateExpression(match.handler);
  }

  private validateContingency(contingency: AST.Contingency): void {
    if (contingency.type === "OnHandler") {
      this.validateOnHandler(contingency);
    } else if (contingency.type === "RouteDeclaration") {
      this.validateRouteDeclaration(contingency);
    } else {
      this.validateOutcomeMatch(contingency);
    }
  }

  private validateRouteDeclaration(route: AST.RouteDeclaration): void {
    // Validate the pipeline expression — all stages receive a piped value (including index 0).
    const previousScope = new Set(this.currentScope);
    this.currentScope.clear();
    if (route.pipeline.type === "PipeExpression") {
      this.validateRoutePipeline(route.pipeline);
    } else if (route.pipeline.type === "CallExpression") {
      // Single-stage route: the stage receives __routeValue — no-args call would be bare identifier,
      // a call with args needs _ if it wants to use the routed value.
      const hasPlaceholder = (route.pipeline as AST.CallExpression).args.some(
        (a) => a.type === "Identifier" && (a as AST.Identifier).name === "_",
      );
      if (
        !hasPlaceholder &&
        (route.pipeline as AST.CallExpression).args.length > 0
      ) {
        this.addError(
          `Route pipeline stage '${(route.pipeline as AST.CallExpression).callee}(...)' has arguments but no '_' placeholder. ` +
            `Use '_' to mark where the routed value goes.`,
          route.pipeline.location,
        );
      }
      this.validateExpression(route.pipeline);
    } else {
      this.validateExpression(route.pipeline);
    }
    this.currentScope = previousScope;
  }

  private validateRoutePipeline(pipe: AST.PipeExpression): void {
    // In a route pipeline, ALL stages receive a piped value (stage[0] receives __routeValue).
    for (const stage of pipe.stages) {
      if (stage.type === "CallExpression") {
        const hasPlaceholder = (stage as AST.CallExpression).args.some(
          (a) => a.type === "Identifier" && (a as AST.Identifier).name === "_",
        );
        if (!hasPlaceholder && (stage as AST.CallExpression).args.length > 0) {
          this.addError(
            `Route pipeline stage '${(stage as AST.CallExpression).callee}(...)' has arguments but no '_' placeholder. ` +
              `Use '_' to mark where the piped value goes (e.g. '${(stage as AST.CallExpression).callee}(_, ...)'), ` +
              `or write just '${(stage as AST.CallExpression).callee}' to pass the piped value as the sole argument.`,
            stage.location,
          );
        }
      }
      this.validateExpression(stage);
    }
    for (const match of pipe.outcomeMatches) {
      this.validateOutcomeMatch(match);
    }
  }

  private validateOnHandler(handler: AST.OnHandler): void {
    // On handlers should only reference module-level bindings
    // We'll check that the handler expression doesn't use parameters from local scopes
    const previousScope = new Set(this.currentScope);
    this.currentScope.clear(); // Clear local scope for on-handler validation

    this.validateExpression(handler.handler);

    this.currentScope = previousScope;
  }

  private checkForSelfReference(
    body: AST.Expression | AST.IndentedBody,
    functionName: string,
  ): boolean {
    if (body.type === "IndentedBody") {
      return body.statements.some((stmt) => {
        if (stmt.type === "BindingDeclaration") {
          return this.checkForSelfReferenceExpr(stmt.value, functionName);
        } else {
          return this.checkForSelfReferenceExpr(stmt, functionName);
        }
      });
    }
    return this.checkForSelfReferenceExpr(body, functionName);
  }

  private walkExpression(expr: AST.Expression, visitor: (e: AST.Expression) => void): void {
    visitor(expr);
    switch (expr.type) {
      case "InterpolatedStringLiteral":
        expr.segments.forEach((seg) => { if (seg.kind === "expr") this.walkExpression(seg.expression, visitor); });
        break;
      case "CallExpression":
        expr.args.forEach((arg) => { this.walkExpression(arg, visitor); });
        break;
      case "PipeExpression":
        expr.stages.forEach((stage) => { this.walkExpression(stage, visitor); });
        expr.outcomeMatches.forEach((m) => { this.walkExpression(m.handler, visitor); });
        break;
      case "ParallelExpression":
        expr.branches.forEach((branch) => { this.walkExpression(branch, visitor); });
        this.walkExpression(expr.gatherPipe.target, visitor);
        break;
      case "Lambda":
        this.walkExpression(expr.body, visitor);
        break;
      case "ListLiteral":
        expr.elements.forEach((elem) => { this.walkExpression(elem, visitor); });
        break;
      case "RecordLiteral":
        expr.fields.forEach((f) => { this.walkExpression(f.value, visitor); });
        break;
      case "FieldAccessExpression":
        this.walkExpression(expr.receiver, visitor);
        break;
      case "TaggedExpression":
        this.walkExpression(expr.value, visitor);
        break;
      case "StreamSymbol":
        break;
    }
  }

  private checkForSelfReferenceExpr(expr: AST.Expression, functionName: string): boolean {
    let found = false;
    this.walkExpression(expr, (e) => {
      if (e.type === "Identifier" && e.name === functionName) found = true;
      if (e.type === "CallExpression" && e.callee === functionName) found = true;
    });
    return found;
  }

  private countOutcomePaths(body: AST.Expression | AST.IndentedBody): number {
    if (body.type === "IndentedBody") {
      // Count outcomes in all statements
      return body.statements.reduce((count, stmt) => {
        if (stmt.type !== "BindingDeclaration") {
          return count + this.countOutcomePathsExpr(stmt);
        }
        return count;
      }, 0);
    }
    return this.countOutcomePathsExpr(body);
  }

  private countOutcomePathsExpr(expr: AST.Expression): number {
    switch (expr.type) {
      case "PipeExpression": {
        // Count stream emits + outcome matches
        let count = 0;
        if (expr.streamEmit) count++;
        count += expr.outcomeMatches.length;
        return count;
      }
      case "ParallelExpression": {
        let pcount = 0;
        if (expr.gatherPipe.streamEmit) pcount++;
        // ParallelExpression doesn't have outcomeMatches directly
        return pcount;
      }
      default:
        return 0;
    }
  }

  private isStringLiteral(value: string): boolean {
    // Check if it looks like a string literal (simple heuristic)
    // In practice, the emission contract stores the actual stream name without quotes
    // So we just ensure it's a valid identifier-like string
    return /^[a-z_][a-z0-9_ -]*$/.test(value);
  }

  private checkElementType(
    elem: AST.Expression,
    expected: string,
  ): string | null {
    switch (elem.type) {
      case "NumberLiteral":
        if (expected === "Int" || expected === "Float") return null;
        return "Number";
      case "StringLiteral":
        if (expected === "String") return null;
        return "String";
      case "BooleanLiteral":
        if (expected === "Bool") return null;
        return "Bool";
      case "RecordLiteral":
        if (elem.typeName === expected) return null;
        return elem.typeName;
      default:
        // Can't statically check calls, identifiers, pipes — trust the user
        return null;
    }
  }
}
