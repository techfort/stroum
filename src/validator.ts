import * as AST from './ast';
import { SourceLocation } from './types';
import { StdlibLoader } from './stdlib-loader';
import { ModuleResolver } from './module-resolver';

export interface ValidationError {
  type: 'error';
  message: string;
  location: SourceLocation;
}

export interface ValidationWarning {
  type: 'warning';
  message: string;
  location: SourceLocation;
}

export type ValidationIssue = ValidationError | ValidationWarning;

interface ImportedScope {
  modulePath: string;
  functions: Set<string>; // Available function names
  alias: string | null; // For qualified access
}

export class Validator {
  private errors: ValidationError[] = [];
  private warnings: ValidationWarning[] = [];
  private moduleBindings: Set<string> = new Set();
  private currentScope: Set<string> = new Set();
  private currentFunctionName: string | null = null;
  private stdlibLoader: StdlibLoader;
  private moduleResolver: ModuleResolver;
  private imports: ImportedScope[] = [];
  private currentFilePath: string = '';

  constructor(stdlibPath?: string) {
    this.stdlibLoader = new StdlibLoader(stdlibPath);
    this.moduleResolver = new ModuleResolver(stdlibPath);
  }

  validate(module: AST.Module, filePath?: string): ValidationIssue[] {
    this.errors = [];
    this.warnings = [];
    this.moduleBindings.clear();
    this.currentScope.clear();
    this.imports = [];
    this.currentFilePath = filePath || '';

    // Process imports
    for (const importDecl of module.imports) {
      this.processImport(importDecl);
    }

    // First pass: collect all module-level bindings
    for (const def of module.definitions) {
      if (def.type === 'FunctionDeclaration') {
        this.addModuleBinding(def.name, def.location);
      } else if (def.type === 'BindingDeclaration') {
        this.addModuleBinding(def.name, def.location);
      }
      // Struct names are types, not bindings
    }

    // Second pass: validate each definition
    for (const def of module.definitions) {
      this.validateDefinition(def);
    }

    // Validate primary expressions
    for (const primaryExpr of module.primaryExpressions) {
      this.validateExpression(primaryExpr);
    }

    // Validate contingencies
    for (const contingency of module.contingencies) {
      this.validateContingency(contingency);
    }

    return [...this.errors, ...this.warnings];
  }

  private processImport(importDecl: AST.ImportDeclaration): void {
    try {
      const resolvedPath = this.moduleResolver.resolveModulePath(
        importDecl.modulePath,
        this.currentFilePath
      );

      const resolved = this.moduleResolver.loadModule(resolvedPath);
      const functions = new Set<string>();

      // If selective imports, only add those functions
      if (importDecl.imports) {
        for (const funcName of importDecl.imports) {
          // Check if function exists in the module
          const exists = resolved.module.definitions.some(
            def => def.type === 'FunctionDeclaration' && def.name === funcName
          );
          if (!exists) {
            this.addError(
              `Function '${funcName}' not found in module '${importDecl.modulePath}'`,
              importDecl.location
            );
          } else {
            functions.add(funcName);
          }
        }
      } else {
        // Import all functions from the module
        for (const def of resolved.module.definitions) {
          if (def.type === 'FunctionDeclaration') {
            functions.add(def.name);
          }
        }
      }

      this.imports.push({
        modulePath: importDecl.modulePath,
        functions,
        alias: importDecl.alias
      });
    } catch (error) {
      this.addError(
        `Failed to resolve import: ${error instanceof Error ? error.message : String(error)}`,
        importDecl.location
      );
    }
  }

  private isFunctionAvailable(name: string): boolean {
    // __builtin_* names are TypeScript-level primitives, always available
    if (name.startsWith('__builtin_')) {
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

  private isQualifiedFunctionAvailable(alias: string, funcName: string): boolean {
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
        location
      );
    } else {
      this.moduleBindings.add(name);
    }
  }

  private addError(message: string, location: SourceLocation): void {
    this.errors.push({ type: 'error', message, location });
  }

  private addWarning(message: string, location: SourceLocation): void {
    this.warnings.push({ type: 'warning', message, location });
  }

  private validateDefinition(def: AST.Declaration): void {
    switch (def.type) {
      case 'FunctionDeclaration':
        this.validateFunctionDeclaration(def);
        break;
      case 'BindingDeclaration':
        this.validateBindingDeclaration(def);
        break;
      case 'StructDeclaration':
        this.validateStructDeclaration(def);
        break;
    }
  }

  private validateFunctionDeclaration(func: AST.FunctionDeclaration): void {
    const previousScope = new Set(this.currentScope);
    const previousFunctionName = this.currentFunctionName;
    this.currentScope.clear();
    this.currentFunctionName = func.name;

    // Add function parameters to scope
    for (const param of func.params) {
      if (this.currentScope.has(param)) {
        this.addError(
          `Duplicate parameter name: '${param}'`,
          func.location
        );
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
            func.location
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
          func.location
        );
      }
    }

    // Check for multiple outcome paths without emission contract
    if (!func.emissionContract) {
      const outcomeCount = this.countOutcomePaths(func.body);
      if (outcomeCount > 1) {
        this.addWarning(
          `Function '${func.name}' has ${outcomeCount} outcome paths but no emission contract (~>)`,
          func.location
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
          struct.location
        );
      } else {
        fieldNames.add(field.name);
      }
    }
  }

  private validateBody(body: AST.Expression | AST.IndentedBody): void {
    if (body.type === 'IndentedBody') {
      for (const stmt of body.statements) {
        if (stmt.type === 'BindingDeclaration') {
          this.validateBindingDeclaration(stmt);
        } else {
          this.validateExpression(stmt);
        }
      }
    } else {
      this.validateExpression(body);
    }
  }

  private validateExpression(expr: AST.Expression): void {
    switch (expr.type) {
      case 'Identifier': {
        // Check if identifier is available (local binding, parameter, import, or stdlib)
        const name = expr.name;
        // `_` is the pipe placeholder; `__outcome_value__` and `__builtin_*` are synthetic
        if (name === '_' || name === '__outcome_value__' || name.startsWith('__builtin_')) break;
        if (!this.isFunctionAvailable(name) && name !== this.currentFunctionName) {
          this.addError(
            `Undefined identifier: '${name}'. ` +
            `It is not defined as a binding, function, parameter, or import.`,
            expr.location
          );
        }
        break;
      }
      case 'NumberLiteral':
      case 'StringLiteral':
      case 'BooleanLiteral':
        break;
      case 'InterpolatedStringLiteral':
        for (const seg of expr.segments) {
          if (seg.kind === 'expr') {
            this.validateExpression(seg.expression);
          }
        }
        break;
      case 'ListLiteral':
        for (const elem of expr.elements) {
          this.validateExpression(elem);
        }
        break;
      case 'RecordLiteral':
        for (const field of expr.fields) {
          this.validateExpression(field.value);
        }
        break;
      case 'CallExpression':
        // Validate function call - check if function exists
        const callee = expr.callee;
        
        // Check for qualified calls (alias.function)
        if (callee.includes('.')) {
          const [alias, funcName] = callee.split('.');
          if (!this.isQualifiedFunctionAvailable(alias, funcName)) {
            this.addError(
              `Undefined qualified function: '${callee}'. ` +
              `Check that '${alias}' is imported with an alias and contains function '${funcName}'.`,
              expr.location
            );
          }
        } else {
          // Direct function call
          if (!this.isFunctionAvailable(callee)) {
            this.addError(
              `Undefined function: '${callee}'. ` +
              `Function is not defined locally, imported, or available in stdlib.`,
              expr.location
            );
          }
        }
        
        // Validate arguments
        for (const arg of expr.args) {
          this.validateExpression(arg);
        }
        break;
      case 'PipeExpression':
        // stage[0] is the initial value; stages[1..n] must thread the piped value.
        // A CallExpression with args but no _ is an error in a piped stage.
        for (let i = 0; i < expr.stages.length; i++) {
          const stage = expr.stages[i];
          if (i > 0 && stage.type === 'CallExpression') {
            const hasPlaceholder = (stage as AST.CallExpression).args.some(
              a => a.type === 'Identifier' && (a as AST.Identifier).name === '_'
            );
            if (!hasPlaceholder && (stage as AST.CallExpression).args.length > 0) {
              this.addError(
                `Pipe stage '${(stage as AST.CallExpression).callee}(...)' has arguments but no '_' placeholder. ` +
                `Use '_' to mark where the piped value goes (e.g. '${(stage as AST.CallExpression).callee}(_, ...)'), ` +
                `or write just '${(stage as AST.CallExpression).callee}' to pass the piped value as the sole argument. ` +
                `To call '${(stage as AST.CallExpression).callee}' independently, write it as a separate statement.`,
                stage.location
              );
            }
          }
          this.validateExpression(stage);
        }
        for (const match of expr.outcomeMatches) {
          this.validateOutcomeMatch(match);
        }
        break;
      case 'ParallelExpression':
        for (const branch of expr.branches) {
          this.validateExpression(branch);
        }
        this.validateExpression(expr.gatherPipe.target);
        break;
      case 'Lambda':
        this.validateLambda(expr);
        break;
      case 'IfExpression':
        // Validate condition and both branches
        this.validateExpression(expr.condition);
        this.validateExpression(expr.thenBranch);
        this.validateExpression(expr.elseBranch);
        break;
      case 'TaggedExpression':
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
          lambda.location
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
    if (contingency.type === 'OnHandler') {
      this.validateOnHandler(contingency);
    } else if (contingency.type === 'RouteDeclaration') {
      this.validateRouteDeclaration(contingency);
    } else {
      this.validateOutcomeMatch(contingency);
    }
  }

  private validateRouteDeclaration(route: AST.RouteDeclaration): void {
    // Validate the pipeline expression — all stages receive a piped value (including index 0).
    const previousScope = new Set(this.currentScope);
    this.currentScope.clear();
    if (route.pipeline.type === 'PipeExpression') {
      this.validateRoutePipeline(route.pipeline);
    } else if (route.pipeline.type === 'CallExpression') {
      // Single-stage route: the stage receives __routeValue — no-args call would be bare identifier,
      // a call with args needs _ if it wants to use the routed value.
      const hasPlaceholder = (route.pipeline as AST.CallExpression).args.some(
        a => a.type === 'Identifier' && (a as AST.Identifier).name === '_'
      );
      if (!hasPlaceholder && (route.pipeline as AST.CallExpression).args.length > 0) {
        this.addError(
          `Route pipeline stage '${(route.pipeline as AST.CallExpression).callee}(...)' has arguments but no '_' placeholder. ` +
          `Use '_' to mark where the routed value goes.`,
          route.pipeline.location
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
      if (stage.type === 'CallExpression') {
        const hasPlaceholder = (stage as AST.CallExpression).args.some(
          a => a.type === 'Identifier' && (a as AST.Identifier).name === '_'
        );
        if (!hasPlaceholder && (stage as AST.CallExpression).args.length > 0) {
          this.addError(
            `Route pipeline stage '${(stage as AST.CallExpression).callee}(...)' has arguments but no '_' placeholder. ` +
            `Use '_' to mark where the piped value goes (e.g. '${(stage as AST.CallExpression).callee}(_, ...)'), ` +
            `or write just '${(stage as AST.CallExpression).callee}' to pass the piped value as the sole argument.`,
            stage.location
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
    
    // Check if handler uses any identifiers not in module scope
    const usedIdentifiers = this.collectIdentifiers(handler.handler);
    for (const id of usedIdentifiers) {
      if (!this.moduleBindings.has(id)) {
        // Could be a built-in or parameter - we allow it but warn if suspicious
        // (This is a simplified check; real implementation might need more context)
      }
    }

    this.currentScope = previousScope;
  }

  private checkForSelfReference(body: AST.Expression | AST.IndentedBody, functionName: string): boolean {
    if (body.type === 'IndentedBody') {
      return body.statements.some(stmt => {
        if (stmt.type === 'BindingDeclaration') {
          return this.checkForSelfReferenceExpr(stmt.value, functionName);
        } else {
          return this.checkForSelfReferenceExpr(stmt, functionName);
        }
      });
    }
    return this.checkForSelfReferenceExpr(body, functionName);
  }

  private checkForSelfReferenceExpr(expr: AST.Expression, functionName: string): boolean {
    switch (expr.type) {
      case 'Identifier':
        return expr.name === functionName;
      case 'CallExpression':
        // callee is a string
        if (expr.callee === functionName) {
          return true;
        }
        return expr.args.some(arg => this.checkForSelfReferenceExpr(arg, functionName));
      case 'PipeExpression':
        return expr.stages.some(stage => this.checkForSelfReferenceExpr(stage, functionName)) ||
               expr.outcomeMatches.some(match => this.checkForSelfReferenceExpr(match.handler, functionName));
      case 'ParallelExpression':
        return expr.branches.some(branch => this.checkForSelfReferenceExpr(branch, functionName)) ||
               this.checkForSelfReferenceExpr(expr.gatherPipe.target, functionName);
      case 'Lambda':
        return this.checkForSelfReferenceExpr(expr.body, functionName);
      case 'ListLiteral':
        return expr.elements.some(elem => this.checkForSelfReferenceExpr(elem, functionName));
      case 'RecordLiteral':
        return expr.fields.some(field => this.checkForSelfReferenceExpr(field.value, functionName));
      default:
        return false;
    }
  }

  private countOutcomePaths(body: AST.Expression | AST.IndentedBody): number {
    if (body.type === 'IndentedBody') {
      // Count outcomes in all statements
      return body.statements.reduce((count, stmt) => {
        if (stmt.type !== 'BindingDeclaration') {
          return count + this.countOutcomePathsExpr(stmt);
        }
        return count;
      }, 0);
    }
    return this.countOutcomePathsExpr(body);
  }

  private countOutcomePathsExpr(expr: AST.Expression): number {
    switch (expr.type) {
      case 'PipeExpression':
        // Count stream emits + outcome matches
        let count = 0;
        if (expr.streamEmit) count++;
        count += expr.outcomeMatches.length;
        return count;
      case 'ParallelExpression':
        let pcount = 0;
        if (expr.gatherPipe.streamEmit) pcount++;
        // ParallelExpression doesn't have outcomeMatches directly
        return pcount;
      default:
        return 0;
    }
  }

  private collectIdentifiers(expr: AST.Expression): Set<string> {
    const identifiers = new Set<string>();

    const collect = (e: AST.Expression): void => {
      switch (e.type) {
        case 'Identifier':
          identifiers.add(e.name);
          break;
        case 'NumberLiteral':
        case 'StringLiteral':
        case 'BooleanLiteral':
          // Literals don't contain identifiers
          break;
        case 'InterpolatedStringLiteral':
          e.segments.forEach(seg => {
            if (seg.kind === 'expr') collect(seg.expression);
          });
          break;
        case 'CallExpression':
          // callee is a string
          e.args.forEach(collect);
          break;
        case 'PipeExpression':
          e.stages.forEach(collect);
          e.outcomeMatches.forEach((m: AST.OutcomeMatch) => collect(m.handler));
          break;
        case 'ParallelExpression':
          e.branches.forEach(collect);
          collect(e.gatherPipe.target);
          break;
        case 'Lambda':
          // Don't collect lambda parameters as "used identifiers"
          collect(e.body);
          break;
        case 'ListLiteral':
          e.elements.forEach(collect);
          break;
        case 'RecordLiteral':
          e.fields.forEach((f: AST.RecordField) => collect(f.value));
          break;
        case 'TaggedExpression':
          collect(e.value);
          break;
      }
    };

    collect(expr);
    return identifiers;
  }

  private isStringLiteral(value: string): boolean {
    // Check if it looks like a string literal (simple heuristic)
    // In practice, the emission contract stores the actual stream name without quotes
    // So we just ensure it's a valid identifier-like string
    return /^[a-z_][a-z0-9_]*$/.test(value);
  }
}
