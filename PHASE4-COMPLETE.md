# Phase 4 Complete: Transpiler

The Stroum transpiler generates TypeScript code from validated AST nodes. This phase implements the complete code generation pipeline, transforming Stroum's functional, pipe-first, stream-oriented constructs into idiomatic TypeScript with async/await patterns.

## Architecture

### Overview

The transpiler performs a single-pass traversal of the AST, generating TypeScript code with:
- **Async/await transformation**: All function calls become awaited expressions
- **Promise.all for parallelism**: PP operator becomes Promise.all
- **Runtime library integration**: Stream routing and outcome matching via runtime helpers
- **Type mapping**: Stroum types (String, Int, Float) map to TypeScript primitives

### Key Components

1. **Transpiler class** (`src/transpiler.ts`):
   - `transpile(ast)`: Main entry point, generates complete TypeScript program
   - `transpileExpression(expr)`: Dispatches to specific expression handlers
   - `transpilePipeExpression(pipe)`: Generates pipe chain with outcome matching
   - `transpileParallelExpression(parallel)`: Generates Promise.all with gather function
   - `transpileLambda(lambda)`: Generates async arrow functions
   - `transpileOnHandler(handler)`: Registers contingency handlers

2. **Runtime library** (`src/runtime-template.ts`):
   - `StreamRouter`: Manages stream routing and handler registration
   - `__router`: Global router instance
   - `__route(value, stream)`: Routes values to named streams
   - `__matchOutcome(value, outcomeName)`: Matches outcome objects
   - `__partialPipe(fn, arg)`: Supports partial application (|?> operator)

## Code Generation Patterns

### Functions

**Stroum**:
```
f:add a b => plus(a, b)
```

**TypeScript**:
```typescript
async function add(a, b) {
  return await plus(a, b);
}
```

All functions are async and all calls are awaited to support stream routing and outcome matching.

### Pipe Chains

**Stroum**:
```
:result fetch(url) |> parse |> transform
```

**TypeScript**:
```typescript
const result = await transform(await parse(await fetch(url)));
```

Pipe chains are right-associative and generate nested await expressions.

### Parallel Composition

**Stroum**:
```
fetch(a) PP fetch(b) |> merge
```

**TypeScript**:
```typescript
await merge(await Promise.all([await fetch(a), await fetch(b)]))
```

The PP operator generates Promise.all, and the gather function receives the array of results.

### Stream Routing

**Stroum**:
```
compute() @ "results"
```

**TypeScript**:
```typescript
__route(await compute(), "results")
```

Stream routing uses the runtime helper to emit values to named channels.

### Outcome Matching

**Stroum**:
```
validate(data)
| .ok    @ "clean"
| .error @ "rejected"
```

**TypeScript**:
```typescript
(async () => {
  let __value = await validate(data);
  if (__value && typeof __value === 'object' && __value.outcome === 'ok') {
    __value = __route(__value, "clean");
  }
  if (__value && typeof __value === 'object' && __value.outcome === 'error') {
    __value = __route(__value, "rejected");
  }
  return __value;
})()
```

Outcome matching generates runtime checks with an IIFE to allow multiple matches.

### On Handlers

**Stroum**:
```
on @"errors" e => log(e)
```

**TypeScript**:
```typescript
__router.on("errors", async (e) => await log(e));
```

On handlers register callbacks with the global router for contingency stream management.

### Structs

**Stroum**:
```
s:User
  name: String
  age: Int
```

**TypeScript**:
```typescript
interface User {
  name: string;
  age: number;
}
```

Structs become TypeScript interfaces with mapped field types.

## Test Coverage

The transpiler has 21 test cases covering:

### Literals (5 tests)
- Number literals
- String literals
- Boolean literals
- List literals
- Record literals

### Functions (3 tests)
- Simple function definition
- Multiple parameters
- Recursive functions (rec keyword)

### Structs (1 test)
- Struct to interface mapping

### Pipe Expressions (3 tests)
- Simple pipe chains
- Pipe with stream emit
- Pipe in function body

### Parallel Expressions (2 tests)
- Parallel composition with gather
- Parallel with stream emit

### Lambdas (2 tests)
- Single parameter lambda
- Multiple parameter lambda

### On Handlers (1 test)
- Handler registration

### Complete Programs (3 tests)
- Simple program
- Program with outcome matches
- Program with structs and functions

### Imports (1 test)
- Runtime import statement

## CLI Integration

The transpiler is integrated into the CLI's compile command:

```bash
npm run dev -- compile input.stm -o output.ts
```

The CLI pipeline:
1. **Lexer**: Tokenize source file
2. **Parser**: Build AST
3. **Validator**: Check semantics (errors block transpilation)
4. **Transpiler**: Generate TypeScript code
5. **Output**: Write .ts file and runtime library

Example output:
```
[stroum] Phase 4 complete: transpilation successful
[stroum] Output written to: output.ts
[stroum] Runtime written to: stroum-runtime.ts
```

## Runtime Library

The runtime library (`stroum-runtime.ts`) provides:

### StreamRouter Class
```typescript
class StreamRouter {
  on(streamName: string, handler: (value: any) => Promise<any>): void
  emit(streamName: string, value: any): Promise<void>
}
```

- `on`: Register a handler for a named stream
- `emit`: Emit a value to all handlers registered for a stream

### Helper Functions

- `__router`: Global StreamRouter instance
- `__route(value, streamName?)`: Routes value to stream or returns it
- `__matchOutcome(value, outcomeName)`: Checks if value matches outcome
- `__partialPipe(fn, arg)`: Partially applies a function (for |?> operator)

The runtime library is automatically emitted to the output directory alongside the transpiled TypeScript file.

## Type Mapping

| Stroum Type | TypeScript Type |
|-------------|-----------------|
| String      | string          |
| Int         | number          |
| Float       | number          |
| Bool        | boolean         |
| User-defined | interface      |

## Example: Complete Program

### Input (Stroum)
```
f:double n => multiply(n, 2)

f:add a b => plus(a, b)

on @"trace" x => console_log(x)

:result add(double(5), double(3)) @ "trace"
```

### Output (TypeScript)
```typescript
import { __router, __route, __matchOutcome, __partialPipe } from './stroum-runtime';

async function double(n) {
  return await multiply(n, 2);
}

async function add(a, b) {
  return await plus(a, b);
}

// Main program
(async () => {
  __router.on("trace", async (x) => await console_log(x));
  const result = __route(await add(await double(5), await double(3)), "trace");
})();
```

## Known Limitations

1. **No type inference**: The transpiler generates untyped TypeScript (uses `any` for lambda parameters)
2. **No optimization**: All calls are awaited, even if they could be synchronous
3. **No dead code elimination**: All definitions are emitted, even if unused
4. **No module system**: All code is in a single file with a single runtime import

## Future Enhancements

- Type inference and annotation
- Module system support
- Import/export statements
- Optimization passes (eliminate unnecessary awaits)
- Source maps for debugging
- Better error messages with source locations
- Support for external TypeScript library imports

## Test Results

```
Test Suites: 1 passed, 1 total
Tests:       21 passed, 21 total
```

All transpiler tests pass, covering all major language constructs and code generation patterns.

## Total Project Status

With Phase 4 complete, the Stroum transpiler now has:

- **147 total tests passing** across 5 test suites
- **Full language support**: Lexer, Parser, Validator, Transpiler
- **Complete CLI**: Compile command with error reporting
- **Runtime library**: Stream routing and outcome matching support

The transpiler can now compile complete Stroum programs to executable TypeScript code.
