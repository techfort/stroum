"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Transpiler = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
class Transpiler {
    constructor(stdlibPath) {
        this.indent = 0;
        this.output = [];
        this.stdlibPath = stdlibPath || path.join(__dirname, '../stdlib');
    }
    transpile(module, currentFilePath) {
        this.indent = 0;
        this.output = [];
        // Emit runtime import
        this.emit(`import { __router, __route, __matchOutcome, __partialPipe } from './stroum-runtime';`);
        // Auto-import stdlib functions (unless --no-stdlib was used)
        if (this.stdlibPath) {
            this.emit(`import { add, sub, mul, div, mod, pow, abs, min, max, eq, neq, gt, gte, lt, lte, and, or, not, concat, length, upper, lower, trim, split, join, starts_with, ends_with, contains, map, filter, reduce, head, tail, take, drop, reverse, sort, is_empty, print, println, debug, trace, to_string, to_int, to_float, error, try_catch } from './stdlib-runtime';`);
        }
        // Emit imports for imported modules
        if (module.imports.length > 0) {
            this.emit('');
            for (const importDecl of module.imports) {
                this.transpileImport(importDecl, currentFilePath);
            }
        }
        this.emit('');
        // Transpile struct declarations (as TypeScript interfaces)
        for (const def of module.definitions) {
            if (def.type === 'StructDeclaration') {
                this.transpileStructDeclaration(def);
            }
        }
        // Transpile function and binding declarations
        for (const def of module.definitions) {
            if (def.type === 'FunctionDeclaration') {
                this.transpileFunctionDeclaration(def);
            }
            else if (def.type === 'BindingDeclaration') {
                this.transpileBindingDeclaration(def);
            }
        }
        // Transpile main program
        if (module.primaryExpressions.length > 0 || module.contingencies.length > 0) {
            this.emit('');
            this.emit('// Main program');
            this.emit('(async () => {');
            this.indent++;
            // Register on-handlers and route declarations first
            for (const contingency of module.contingencies) {
                if (contingency.type === 'OnHandler') {
                    this.transpileOnHandler(contingency);
                }
                else if (contingency.type === 'RouteDeclaration') {
                    this.transpileRouteDeclaration(contingency);
                }
            }
            // Execute primary expressions in order
            for (const primaryExpr of module.primaryExpressions) {
                const expr = this.transpileExpression(primaryExpr);
                this.emit(`await ${expr};`);
            }
            this.indent--;
            this.emit('})();');
        }
        return this.output.join('\n');
    }
    transpileImport(importDecl, currentFilePath) {
        const modulePath = importDecl.modulePath;
        // Check if it's a stdlib module or a file import
        const isStdlibModule = !modulePath.startsWith('./') && !modulePath.startsWith('../') && !path.isAbsolute(modulePath);
        if (isStdlibModule) {
            // Stdlib import - import from stdlib-runtime
            if (importDecl.alias) {
                // Qualified import: import * as alias from './stdlib-runtime'
                this.emit(`import * as ${importDecl.alias} from './stdlib-runtime';`);
            }
            else if (importDecl.imports) {
                // Selective import: import { fn1, fn2 } from './stdlib-runtime'
                const functions = importDecl.imports.join(', ');
                this.emit(`import { ${functions} } from './stdlib-runtime';`);
            }
            else {
                // Import all functions from a named stdlib module
                const stdlibModuleFunctions = {
                    io: [
                        'read_file', 'write_file', 'append_file', 'file_exists', 'delete_file',
                        'list_dir', 'make_dir', 'read_lines', 'write_lines',
                        'path_join', 'path_basename', 'path_dirname', 'path_ext',
                    ],
                    process: [
                        'exec', 'exec_lines', 'env_get', 'env_get_or', 'env_keys', 'cwd', 'exit_process',
                    ],
                    timer: [
                        'sleep', 'now', 'timestamp', 'elapsed', 'format_date',
                    ],
                };
                const knownFunctions = stdlibModuleFunctions[modulePath];
                if (knownFunctions) {
                    this.emit(`import { ${knownFunctions.join(', ')} } from './stdlib-runtime';`);
                }
                // For 'core' and unknown modules, the auto-import at the top already covers them
            }
        }
        else {
            // File import - resolve relative path and import from transpiled .ts file
            if (!currentFilePath) {
                // Can't resolve relative imports without knowing current file
                this.emit(`// WARNING: Cannot resolve relative import without current file path: ${modulePath}`);
                return;
            }
            const currentDir = path.dirname(currentFilePath);
            const absolutePath = path.resolve(currentDir, modulePath);
            const relativePath = path.relative(path.dirname(currentFilePath), absolutePath);
            // Remove .stm extension and ensure it starts with ./
            let importPath = relativePath.replace(/\.stm$/, '');
            if (!importPath.startsWith('.')) {
                importPath = './' + importPath;
            }
            if (importDecl.alias) {
                // Qualified import: import * as alias from './module'
                this.emit(`import * as ${importDecl.alias} from '${importPath}';`);
            }
            else if (importDecl.imports) {
                // Selective import: import { fn1, fn2 } from './module'
                const functions = importDecl.imports.join(', ');
                this.emit(`import { ${functions} } from '${importPath}';`);
            }
            else {
                // Full import: import all exported functions
                // We need to load the module to see what functions it exports
                try {
                    const source = fs.readFileSync(absolutePath, 'utf-8');
                    const lexer = new lexer_1.Lexer(source);
                    const tokens = lexer.tokenize();
                    const parser = new parser_1.Parser(tokens);
                    const module = parser.parse();
                    // Extract all function names
                    const functions = [];
                    for (const def of module.definitions) {
                        if (def.type === 'FunctionDeclaration') {
                            functions.push(def.name);
                        }
                    }
                    if (functions.length > 0) {
                        this.emit(`import { ${functions.join(', ')} } from '${importPath}';`);
                    }
                }
                catch (error) {
                    // Fallback to namespace import if we can't parse the module
                    this.emit(`import * as __imported_${path.basename(modulePath, '.stm')} from '${importPath}';`);
                }
            }
        }
    }
    transpileStructDeclaration(struct) {
        this.emit(`interface ${struct.name} {`);
        this.indent++;
        for (const field of struct.fields) {
            this.emit(`${field.name}: ${this.mapTypeName(field.typeName)};`);
        }
        this.indent--;
        this.emit('}');
        this.emit('');
    }
    transpileFunctionDeclaration(func) {
        const params = func.params.join(', ');
        const asyncMark = 'async ';
        // Export all functions so they can be imported by other modules
        this.emit(`export ${asyncMark}function ${func.name}(${params}) {`);
        this.indent++;
        if (func.body.type === 'IndentedBody') {
            this.transpileIndentedBody(func.body);
        }
        else {
            const expr = this.transpileExpression(func.body);
            this.emit(`return ${expr};`);
        }
        this.indent--;
        this.emit('}');
        this.emit('');
    }
    transpileBindingDeclaration(binding) {
        const value = this.transpileExpression(binding.value);
        this.emit(`const ${binding.name} = ${value};`);
    }
    transpileIndentedBody(body) {
        const stmts = body.statements;
        // Find the index of the last expression statement (the return value)
        let lastExprIdx = -1;
        for (let i = stmts.length - 1; i >= 0; i--) {
            if (stmts[i].type !== 'BindingDeclaration') {
                lastExprIdx = i;
                break;
            }
        }
        for (let i = 0; i < stmts.length; i++) {
            const stmt = stmts[i];
            if (stmt.type === 'BindingDeclaration') {
                this.transpileBindingDeclaration(stmt);
            }
            else if (i === lastExprIdx) {
                const expr = this.transpileExpression(stmt);
                this.emit(`return ${expr};`);
            }
            else {
                const expr = this.transpileExpression(stmt);
                this.emit(`await ${expr};`);
            }
        }
    }
    transpileExpression(expr) {
        switch (expr.type) {
            case 'Identifier':
                return expr.name;
            case 'NumberLiteral':
                return expr.value.toString();
            case 'StringLiteral':
                return JSON.stringify(expr.value);
            case 'BooleanLiteral':
                return expr.value.toString();
            case 'ListLiteral':
                return this.transpileListLiteral(expr);
            case 'RecordLiteral':
                return this.transpileRecordLiteral(expr);
            case 'CallExpression':
                return this.transpileCallExpression(expr);
            case 'PipeExpression':
                return this.transpilePipeExpression(expr);
            case 'ParallelExpression':
                return this.transpileParallelExpression(expr);
            case 'Lambda':
                return this.transpileLambda(expr);
            case 'IfExpression':
                return this.transpileIfExpression(expr);
            case 'TaggedExpression':
                return this.transpileTaggedExpression(expr);
        }
    }
    transpileListLiteral(list) {
        const elements = list.elements.map(e => this.transpileExpression(e));
        return `[${elements.join(', ')}]`;
    }
    transpileRecordLiteral(record) {
        const fields = record.fields.map(f => {
            const value = this.transpileExpression(f.value);
            return `${f.name}: ${value}`;
        });
        return `{ ${fields.join(', ')} }`;
    }
    transpileCallExpression(call) {
        const args = call.args.map(a => this.transpileExpression(a));
        return `await ${call.callee}(${args.join(', ')})`;
    }
    transpilePipeExpression(pipe) {
        // Build a chain of awaited calls
        let result = '';
        if (pipe.stages.length === 0) {
            result = 'undefined';
        }
        else if (pipe.stages.length === 1) {
            result = this.transpileExpression(pipe.stages[0]);
        }
        else {
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
            result = `__route(${result}, ${streamArg})`;
        }
        // Handle outcome matches
        if (pipe.outcomeMatches.length > 0) {
            result = `(async () => {
        let __value = ${result};
${pipe.outcomeMatches.map(m => this.transpileOutcomeMatchInline(m)).join('\n')}
        return __value;
      })()`;
        }
        return result;
    }
    transpileParallelExpression(parallel) {
        // Parallel: branch1 PP branch2 PP branch3 |> gather
        // Becomes: await gather(await Promise.all([branch1, branch2, branch3]))
        const branches = parallel.branches.map(b => this.transpileExpression(b));
        const allPromises = `Promise.all([${branches.join(', ')}])`;
        let result;
        const gatherTarget = parallel.gatherPipe.target;
        if (gatherTarget.type === 'Identifier') {
            result = `await ${gatherTarget.name}(await ${allPromises})`;
        }
        else if (gatherTarget.type === 'CallExpression') {
            const args = gatherTarget.args.map(a => this.transpileExpression(a));
            result = `await ${gatherTarget.callee}(await ${allPromises}${args.length > 0 ? ', ' + args.join(', ') : ''})`;
        }
        else if (gatherTarget.type === 'PipeExpression') {
            // The gather target is itself a pipe chain
            // We need to pass the parallel results as the first value
            result = this.transpilePipeChainWithInitialValue(gatherTarget, `await ${allPromises}`);
        }
        else {
            result = `(${this.transpileExpression(gatherTarget)})(await ${allPromises})`;
        }
        // Handle stream emit on gather pipe
        if (parallel.gatherPipe.streamEmit) {
            const streamArg = this.streamRefToTs(parallel.gatherPipe.streamEmit.streams[0]);
            result = `__route(${result}, ${streamArg})`;
        }
        return result;
    }
    transpilePipeChainWithInitialValue(pipe, initialValue) {
        // Build a chain of awaited calls, starting with initialValue.
        // Every stage threads the piped value (bare name or _ placeholder).
        let result = initialValue;
        for (const stage of pipe.stages) {
            result = this.transpilePipeStage(stage, result);
        }
        // Handle stream emit
        if (pipe.streamEmit) {
            const streamArg = this.streamRefToTs(pipe.streamEmit.streams[0]);
            result = `__route(${result}, ${streamArg})`;
        }
        // Handle outcome matches
        if (pipe.outcomeMatches.length > 0) {
            result = `(async () => {
        let __value = ${result};
${pipe.outcomeMatches.map(m => this.transpileOutcomeMatchInline(m)).join('\n')}
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
    transpilePipeStage(stage, pipedValue) {
        if (stage.type === 'CallExpression') {
            const hasPlaceholder = stage.args.some(a => a.type === 'Identifier' && a.name === '_');
            if (hasPlaceholder) {
                const args = stage.args.map(a => (a.type === 'Identifier' && a.name === '_')
                    ? pipedValue
                    : this.transpileExpression(a));
                return `await ${stage.callee}(${args.join(', ')})`;
            }
            else {
                // No _ placeholder — the validator should have flagged this.
                // As a fallback, throw here to surface the issue clearly.
                throw new Error(`[stroum] pipe stage '${stage.callee}(...)' has arguments but no '_' placeholder. ` +
                    `Use '${stage.callee}(_, ...)' to thread the piped value, or just '${stage.callee}' to pass it as the sole argument.`);
            }
        }
        else if (stage.type === 'Identifier') {
            // Bare name: pass piped value as sole argument
            return `await ${stage.name}(${pipedValue})`;
        }
        else {
            return `(${this.transpileExpression(stage)})(${pipedValue})`;
        }
    }
    // Convert a StreamRef to a TypeScript expression string.
    // Static: "name" (quoted)   Dynamic: name (unquoted binding reference)
    streamRefToTs(ref) {
        return ref.isDynamic ? ref.name : `"${ref.name}"`;
    }
    transpileLambda(lambda) {
        const params = lambda.params.join(', ');
        const body = this.transpileExpression(lambda.body);
        return `async (${params}) => ${body}`;
    }
    transpileTaggedExpression(expr) {
        const value = this.transpileExpression(expr.value);
        return `{ outcome: ${JSON.stringify(expr.tag.name)}, value: ${value} }`;
    }
    tagRefToTs(ref) {
        return JSON.stringify(ref.name);
    }
    // Transpile an outcome match handler, calling it with the inner unwrapped value.
    // Bare identifier: await fn(inner)
    // Call with _:   await fn(inner, other)
    // Call without _: await fn(args)  — explicitly ignores the inner value
    // Other (lambda): await (expr)(inner)
    transpileOutcomeHandler(handler, innerVar) {
        if (handler.type === 'Identifier') {
            return `await ${handler.name}(${innerVar})`;
        }
        else if (handler.type === 'CallExpression') {
            const hasPlaceholder = handler.args.some(a => a.type === 'Identifier' && a.name === '_');
            if (hasPlaceholder) {
                const args = handler.args.map(a => (a.type === 'Identifier' && a.name === '_')
                    ? innerVar
                    : this.transpileExpression(a));
                return `await ${handler.callee}(${args.join(', ')})`;
            }
            else {
                // Call as-is — handler doesn't use the inner value
                const args = handler.args.map(a => this.transpileExpression(a));
                return `await ${handler.callee}(${args.length > 0 ? args.join(', ') : ''})`;
            }
        }
        else {
            // Lambda or other expression — call with inner value
            return `await (${this.transpileExpression(handler)})(${innerVar})`;
        }
    }
    transpileIfExpression(ifExpr) {
        const condition = this.transpileExpression(ifExpr.condition);
        const thenBranch = this.transpileExpression(ifExpr.thenBranch);
        const elseBranch = this.transpileExpression(ifExpr.elseBranch);
        // Use an IIFE to handle async operations in branches
        return `(await (async () => (${condition}) ? (${thenBranch}) : (${elseBranch}))())`;
    }
    transpileOutcomeMatchInline(match) {
        const tagComparison = this.tagRefToTs(match.tag);
        let handler;
        if (match.handler.type === 'Identifier' && match.handler.name === '__outcome_value__') {
            // Passthrough: | .tag => @"stream" — route/pass the inner value directly
            if (match.streamEmit) {
                const streamArg = this.streamRefToTs(match.streamEmit.streams[0]);
                handler = `await __route(__inner, ${streamArg})`;
            }
            else {
                handler = '__inner';
            }
        }
        else {
            handler = this.transpileOutcomeHandler(match.handler, '__inner');
            if (match.streamEmit) {
                const streamArg = this.streamRefToTs(match.streamEmit.streams[0]);
                handler = `await __route(${handler}, ${streamArg})`;
            }
        }
        return `        if (__value && typeof __value === 'object' && __value.outcome === ${tagComparison}) {
          const __inner = __value.value;
          __value = ${handler};
        }`;
    }
    transpileOnHandler(handler) {
        // Handler.handler is a Lambda, we need to transpile it
        const handlerExpr = this.transpileLambda(handler.handler);
        this.emit(`__router.on("${handler.streamPattern}", ${handlerExpr});`);
    }
    transpileRouteDeclaration(route) {
        // route @"stream" |> op1 |> op2
        // Registers the pipeline as the continuation handler.
        // The emitted value is piped as the first argument to the pipeline.
        const pipeline = route.pipeline;
        let handlerBody;
        if (pipeline.type === 'PipeExpression') {
            handlerBody = this.transpilePipeChainWithInitialValue(pipeline, '__routeValue');
        }
        else if (pipeline.type === 'Identifier') {
            handlerBody = `await ${pipeline.name}(__routeValue)`;
        }
        else if (pipeline.type === 'CallExpression') {
            const args = pipeline.args.map(a => this.transpileExpression(a));
            handlerBody = `await ${pipeline.callee}(__routeValue${args.length > 0 ? ', ' + args.join(', ') : ''})`;
        }
        else {
            handlerBody = this.transpileExpression(pipeline);
        }
        this.emit(`__router.on(${this.streamRefToTs(route.streamPattern)}, async (__routeValue) => { await ${handlerBody}; });`);
    }
    mapTypeName(typeName) {
        // Map Stroum type names to TypeScript types
        const typeMap = {
            'String': 'string',
            'Int': 'number',
            'Float': 'number',
            'Bool': 'boolean',
            'List': 'any[]',
        };
        return typeMap[typeName] || typeName;
    }
    emit(line) {
        const indentation = '  '.repeat(this.indent);
        this.output.push(indentation + line);
    }
    // Generate the runtime file alongside the output
    static emitRuntime(outputDir) {
        const runtimeTemplatePath = path.join(__dirname, 'runtime-template.ts');
        const runtimeOutputPath = path.join(outputDir, 'stroum-runtime.ts');
        const runtimeContent = fs.readFileSync(runtimeTemplatePath, 'utf-8');
        fs.writeFileSync(runtimeOutputPath, runtimeContent);
        // Also emit stdlib-runtime.ts
        const stdlibRuntimePath = path.join(__dirname, 'stdlib', 'stdlib-runtime.ts');
        const stdlibOutputPath = path.join(outputDir, 'stdlib-runtime.ts');
        if (fs.existsSync(stdlibRuntimePath)) {
            const stdlibContent = fs.readFileSync(stdlibRuntimePath, 'utf-8');
            fs.writeFileSync(stdlibOutputPath, stdlibContent);
        }
    }
}
exports.Transpiler = Transpiler;
//# sourceMappingURL=transpiler.js.map