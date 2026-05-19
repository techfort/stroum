# Stroum

A functional, pipe-first, stream-oriented programming language that transpiles to TypeScript.

---

## Features

- **Lexer & Parser** — full tokenization and AST generation with error recovery
- **Validator** — duplicate detection, scope tracking, emission-contract validation
- **Transpiler** — async/await TypeScript output with stream routing and V3 source maps
- **Standard Library** — arithmetic, strings, lists, I/O, type conversion, assertions
- **CLI** — compile, run, format, test, repl, graph, derive, init
- **LSP Language Server** — completions, hover, go-to-definition, document formatting
- **VS Code Extension** — syntax highlighting, snippets, LSP integration
- **REPL** — interactive session with tab completion
- **Test Framework** — first-class `test` declarations run by `stroum test`
- **Watch Mode** — `stroum run --watch` re-runs on file change
- **Source Maps** — `.ts.map` files map generated TypeScript back to `.stm` lines

---

## Installation

```bash
npm install
npm run build
```

---

## CLI Commands

### Compile to TypeScript

```bash
stroum compile input.stm                # produces input.ts + input.ts.map
stroum compile input.stm -o out/app.ts  # custom output path
stroum compile input.stm --ast          # dump AST as JSON
stroum compile input.stm --no-stdlib    # skip auto-import of core
```

### Run directly

```bash
stroum run examples/simple-exec.stm
stroum run examples/demo.stm --trace    # print stream trace after execution
stroum run examples/demo.stm --watch    # re-run whenever the file changes
```

### Format source

```bash
stroum format input.stm                 # print formatted output to stdout
stroum format input.stm --write         # write formatted output back to file
stroum format input.stm --check         # exit 1 if file is not already formatted
```

### Run tests

```bash
stroum test                             # discover and run all *.test.stm files
stroum test examples/                   # run all tests under a directory
stroum test examples/core.test.stm      # run a single test file
```

### Start REPL

```bash
stroum repl
```

Tab-completes stdlib functions and session-defined names. Type `:help` inside the REPL for available commands.

### Dataflow graph

```bash
stroum graph examples/dataflow-graph.stm           # open in browser
stroum graph examples/dataflow-graph.stm --port 4000 --no-open
```

### Derive struct schema

```bash
stroum derive schema data/users.csv              # infer from CSV
stroum derive schema data/payload.json --name Payload --output payload.stm
```

### Initialize a project

```bash
stroum init my-project
```

### Utilities

```bash
stroum version
stroum help
```

---

## VS Code Extension

The extension provides full IDE support via the built-in language server.

**Features:**
- Syntax highlighting for all Stroum constructs
- IntelliSense completions (stdlib functions, user-defined names, keyword snippets)
- Hover documentation for stdlib functions and user-defined symbols
- Go-to-definition for functions, bindings, and structs
- Document formatting on save (or via Format Document command)
- Inline diagnostics (lex, parse, and validation errors)
- Code snippets (`f:`, `s:`, `on`, `route`, `wire:`, etc.)
- Comment toggling with `Ctrl+/`

**Installation:**
```bash
cd vscode-stroum
chmod +x install.sh
./install.sh
```

Reload VS Code and open any `.stm` file. See [vscode-stroum/README.md](vscode-stroum/README.md) for details.

---

## Source Maps

`stroum compile` writes a V3 source map (`.ts.map`) alongside each generated `.ts` file and appends a `sourceMappingURL` comment. The map traces generated TypeScript lines back to their original `.stm` locations.

`stroum run` passes `--sourceMap` to `tsc` and `--enable-source-maps` to Node, so stack traces in runtime errors report `.stm` line numbers instead of generated JavaScript lines.

---

## Test Framework

Test files use the `.test.stm` extension. Each `test` block runs in isolation.

```stroum
test "add works" =>
  assert_eq(add(2, 3), 5)

test "upper converts case" =>
  assert_eq(upper("hello"), "HELLO")

test "error is thrown" =>
  assert_raises(|:_| => error("boom"))
```

**Assertion functions** (available globally):

| Function | Description |
|---|---|
| `assert(cond)` | Fails if `cond` is falsy |
| `assert_eq(left, right)` | Structural equality — shows diff on failure |
| `assert_neq(left, right)` | Fails if values are equal |
| `assert_contains(collection, item)` | String substring or list membership |
| `assert_raises(fn)` | Fails if `fn` does not throw |

---

## Language Overview

Stroum is:
- **Functional** — no mutation, no loops, no classes
- **Pipe-first** — primary composition via `|>`
- **Stream-oriented** — side effects route through named string channels
- **Immutable** — all bindings are single-assignment

See [GUIDE.md](GUIDE.md) for a technical introduction to the language and its design. See [REFERENCE.md](REFERENCE.md) for the full syntax and stdlib reference.

### Key Operators

| Operator | Meaning |
|----------|---------|
| `\|>` | Pipe — pass left value as first argument to the right |
| `\|?>` | Partial gathering pipe |
| `PP` | Parallel composition |
| `XX` | Stream termination |
| `@"name"` | Emit value onto named stream (tee — returns value) |
| `@>"name"` | Redirect value onto stream |
| `~>` | Emission contract declaration |
| `stream:` | Declare a typed named stream |
| `src:` | Open a data source and route output to a stream |
| `snk:` | Subscribe a sink handler to a stream |
| `=>` | Function / lambda body separator |

### Quick example

```stroum
f:double n => mul(n, 2)

:nums [1, 2, 3, 4, 5]

nums |> filter(_, |:n| => gt(n, 2)) |> map(_, double) |> println
```

---

## Standard Library

Auto-imported from `core`:

| Category | Functions |
|---|---|
| Arithmetic | `add`, `sub`, `mul`, `div`, `mod`, `pow`, `abs`, `min`, `max` |
| Comparison | `eq`, `neq`, `gt`, `gte`, `lt`, `lte` |
| Logic | `and`, `or`, `not` |
| Strings | `concat`, `length`, `upper`, `lower`, `trim`, `split`, `join`, `starts_with`, `ends_with`, `contains` |
| Lists | `map`, `filter`, `reduce`, `head`, `tail`, `take`, `drop`, `reverse`, `sort`, `is_empty` |
| I/O | `print`, `println`, `debug`, `trace`, `null_sink`, `log_sink` |
| Type conversion | `to_string`, `to_int`, `to_float` |
| Error handling | `error`, `try_catch` |
| Test assertions | `assert`, `assert_eq`, `assert_neq`, `assert_contains`, `assert_raises` |

Optional modules require an explicit import:

| Module | Import | Purpose |
|---|---|---|
| `io` | `i:io` | File system operations, streaming file sources |
| `process` | `i:process` | Shell commands, environment |
| `timer` | `i:timer` | Sleep, timestamps, elapsed time |
| `formats` | `i:formats` | CSV/JSON parsing and schema inference |

---

## Development

### Run compiler test suite

```bash
npm test
```

412 tests across 16 test suites (lexer, parser, validator, transpiler, formatter, LSP completions, REPL, dataflow analyzer, schema deriver, preprocessor, formats, graph server, error recovery, ingest, CLI, integration).

### Development commands

```bash
npm run dev -- compile input.stm
npm run dev -- run examples/simple-exec.stm
npm run dev -- help
```

---

## Project Structure

```
stroum/
├── src/
│   ├── types.ts                    # Token type definitions
│   ├── ast.ts                      # AST node types
│   ├── diagnostics.ts              # Shared diagnostic types
│   ├── lexer.ts                    # Lexical analyzer
│   ├── lexer.test.ts
│   ├── lexer-integration.test.ts
│   ├── parser.ts                   # Recursive-descent parser
│   ├── parser.test.ts
│   ├── preprocessor.ts             # Directive preprocessor
│   ├── preprocessor.test.ts
│   ├── validator.ts                # Semantic analyzer
│   ├── validator.test.ts
│   ├── transpiler.ts               # TypeScript code generator + source maps
│   ├── transpiler.test.ts
│   ├── formatter.ts                # AST-based source formatter
│   ├── formatter.test.ts
│   ├── language-server.ts          # LSP server (completions, hover, goto, format)
│   ├── lsp-completion.ts           # Completion and hover logic
│   ├── lsp-completion.test.ts
│   ├── repl.ts                     # Interactive REPL
│   ├── repl.test.ts
│   ├── dataflow-analyzer.ts        # Dataflow graph extraction
│   ├── dataflow-analyzer.test.ts
│   ├── graph-server.ts             # HTTP server for graph UI
│   ├── graph-server.test.ts
│   ├── schema-deriver.ts           # CSV/JSON schema inference
│   ├── schema-deriver.test.ts
│   ├── module-resolver.ts          # Multi-file module resolution
│   ├── stdlib-loader.ts            # Stdlib loading utilities
│   ├── runtime-template.ts         # Runtime library template
│   ├── cli.ts                      # Command-line interface
│   └── index.ts                    # Public API exports
├── examples/                       # Example .stm programs
├── stdlib/
│   ├── core.stm                    # Core stdlib declarations
│   ├── stdlib-runtime.ts           # Stdlib implementations
│   └── README.md
├── vscode-stroum/                  # VS Code extension
│   ├── syntaxes/stroum.tmLanguage.json
│   ├── snippets/stroum.json
│   ├── package.json
│   ├── language-configuration.json
│   ├── install.sh
│   └── README.md
├── test-fixtures/
├── package.json
├── tsconfig.json
├── jest.config.js
├── README.md
├── GUIDE.md                           # Technical introduction and design guide
├── REFERENCE.md                       # Language reference
└── SCHEMA-INFERENCE.md
```

---

## License

MIT
