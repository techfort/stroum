# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Build
npm run build              # Compile TypeScript → dist/, copy stdlib, build graph webview
npm run dev -- <args>      # Run without building (ts-node)

# Test
npm test                   # All 15 test suites (~374 tests)
npm test -- lexer          # Run tests matching filename pattern
npm test -- --testNamePattern="keyword"  # Run by test name
npm test src/lexer.test.ts # Run single file

# Lint / Format
npm run lint               # Biome linter
npm run check              # Biome format check
npm run check:fix          # Auto-fix formatting

# Run a Stroum program
npm run dev -- run examples/demo-simple.stm
npm run dev -- run examples/stream-routing.stm --trace
npm run dev -- compile src/examples/foo.stm  # Emit TypeScript
```

## Architecture

### Compiler Pipeline

```
Source → Preprocessor → Lexer → Parser → Validator → Transpiler → TypeScript
```

| Stage | File | Responsibility |
|-------|------|----------------|
| Preprocessor | `src/preprocessor.ts` | Expands `#derive schema` directives before parsing |
| Lexer | `src/lexer.ts` | Tokenization with indentation-aware INDENT/DEDENT emission |
| Parser | `src/parser.ts` | Recursive-descent, produces AST; has error recovery |
| Validator | `src/validator.ts` | Scope, duplicate detection, emission contract checks |
| Transpiler | `src/transpiler.ts` | Generates async/await TypeScript + V3 source maps |

AST types live in `src/ast.ts`; token types in `src/types.ts`.

The CLI entry point is `src/cli.ts` (14 commands: `compile`, `run`, `format`, `test`, `repl`, `graph`, `derive`, `init`, etc.). The `run` command compiles to TS, invokes `tsc`, then runs Node with `--enable-source-maps` so stack traces show `.stm` lines.

### Runtime & Stdlib

- `src/runtime-template.ts` — `StreamRouter` class; `emit(name, value)` is async and awaits all handlers sequentially, enabling feedback loops
- `stdlib/core.stm` — function declarations auto-imported into every module
- `stdlib/stdlib-runtime.ts` — TypeScript implementations of core functions
- Optional modules: `stdlib/io.stm`, `stdlib/process.stm`, `stdlib/timer.stm`, `stdlib/formats.stm`

### Pipe-First Semantics

The `|>` operator is central to Stroum. Two forms:

- **Bare name**: `"hello" |> println` — piped value injected as first argument
- **Placeholder**: `items |> map(_, double)` — `_` marks the injection point

The transpiler converts pipe chains into nested TypeScript `await` calls, right-to-left.

Stream emission `@` terminates a pipe chain and routes the value to a named stream. Handlers subscribe with `on @"stream"` and continuations with `route @"stream"`. Because `emit` is awaited, a handler can re-emit on another stream and the original chain waits for full resolution.

Tagged values use `.tag value` syntax (producer side) and `| .tag => handler` (consumer side) for typed branching — similar to Result/Either.

### Multi-File Support

`src/module-resolver.ts` handles `i:"./file.stm"` imports with circular dependency detection and caching. Stdlib imports use `i:core`, `i:io`, etc.

### Language Server

`src/language-server.ts` implements LSP (diagnostics, completions, hover, go-to-definition, formatting). Completions are in `src/lsp-completion.ts`. The VS Code extension lives in `vscode-stroum/` and launches the language server as a subprocess over stdio.

### Dataflow Graph

`src/dataflow-analyzer.ts` extracts call/stream graphs from the AST. `src/graph-server.ts` serves a Cytoscape.js UI (`stroum graph file.stm`) for visualizing data flow.

## Language Syntax Quick Reference

```stroum
-- Function declaration
f:add a b => a + b

-- Recursive
rec f:fib n =>
  if n <= 1 then n
  else fib(n - 1) + fib(n - 2)

-- Pipe chain
"hello world" |> split(_, " ") |> head |> println

-- Stream emit and handler
f:validate x ~> @"ok", @"fail" =>
  if valid(x) then x @ "ok"
  else x @ "fail"

on @"ok" |> process
on @"fail" |> log_error

-- Tagged values
.ok result         -- produce
result
| .ok   => handle_ok
| .fail => handle_fail

-- Struct
s:User { id: Int, name: String }

-- Import
i:io
i:"./helpers.stm"

-- Test
test "adds numbers"
  assert_eq(add(1, 2), 3)
```

Comments use `--`. There are no semicolons; line breaks and indentation delimit blocks.
