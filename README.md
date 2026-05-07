# Stroum Transpiler

A transpiler for the Stroum functional, pipe-first, stream-oriented programming language that compiles to TypeScript.

## Status: Phase 5 Complete ✓

All phases complete! Stroum is now a fully functional transpiler with a modern CLI.

### Completed Phases

- **Phase 1 - Lexer**: Full tokenization of Stroum source files
  - All token types implemented (identifiers, type names, operators, sigils, literals)
  - Indentation tracking (INDENT/DEDENT tokens)
  - Comment support
  - String literals with escape sequences
  - Error reporting with line and column numbers
  - 60 test cases passing

- **Phase 2 - Parser**: AST generation
  - Recursive descent parser with operator precedence
  - All language constructs (functions, bindings, structs, pipes, parallel composition)
  - Outcome matches and stream routing
  - On handlers for contingency management
  - Error reporting with line and column numbers
  - 48 test cases passing
  - Successfully parses complete programs from spec

- **Phase 3 - Validator**: Semantic analysis and error checking
  - Duplicate binding detection (functions, parameters, struct fields)
  - Scope tracking with shadowing support
  - Recursive function validation (rec keyword usage)
  - Emission contract validation (stream names)
  - Multiple outcome path warnings
  - 18 test cases passing
  - Integration with CLI for error and warning reporting

- **Phase 4 - Transpiler**: TypeScript code generation
  - Async/await transformation for all function calls
  - Promise.all for parallel composition (PP operator)
  - Pipe chain compilation with stream routing
  - Outcome matching with runtime checks
  - Lambda expression support
  - On handler registration for contingency streams
  - Struct to TypeScript interface mapping
  - Runtime library (stroum-runtime.ts) generation
  - 21 test cases passing
  - Full CLI integration

- **Phase 5 - CLI Enhancements**: Modern command-line interface
  - Multiple commands: compile, run, init, version, help
  - Colored terminal output for better UX
  - Project initialization with `stroum init`
  - Direct execution with `stroum run`
  - Integration with stroum-run script
  - npm bin entry for global installation

- **Standard Library**: Comprehensive utility functions
  - Arithmetic: add, sub, mul, div, mod, pow, abs, min, max
  - Comparisons: eq, neq, gt, gte, lt, lte
  - Logic: and, or, not
  - Strings: concat, length, upper, lower, trim, split, join
  - Lists: map, filter, reduce, head, tail, reverse, sort
  - I/O: print, println, debug, trace
  - Type conversion: to_string, to_int, to_float
  - See [stdlib/README.md](stdlib/README.md) for full API

### Test Results
- Total: 147 test cases passing across 5 test suites
- Lexer: 60 tests
- Parser: 48 tests
- Validator: 18 tests
- Transpiler: 21 tests

## Installation

```bash
npm install
```

## Usage

### CLI Commands

The Stroum CLI provides several commands:

**Initialize a new project:**
```bash
stroum init my-project
```

**Compile Stroum to TypeScript:**
```bash
stroum compile input.stm
stroum compile input.stm -o output.ts
stroum compile input.stm --ast  # Show AST
```

**Run a Stroum file directly:**
```bash
stroum run examples/simple-exec.stm
```

**Run tests:**
```bash
stroum test                        # discover and run all *.test.stm files
stroum test examples/              # run all tests under a path
stroum test examples/core.test.stm # run a single test file
```

**Show version:**
```bash
stroum version
```

**Show help:**
```bash
stroum help
```

### Development Commands

During development, you can use npm scripts:

```bash
npm run dev -- <command> <args>
```

Examples:
```bash
npm run dev -- compile input.stm
npm run dev -- run examples/simple-exec.stm
npm run dev -- help
```

### Direct Execution with stroum-run

For quick testing, use the bash script:

```bash
./stroum-run <file.stm>
```

This automatically transpiles, compiles, and executes your Stroum program with built-in functions. See [RUNNER.md](RUNNER.md) for details.

## VS Code Extension

A VS Code extension is included for syntax highlighting and language support:

**Features:**
- Syntax highlighting for all Stroum constructs
- Code snippets (type `fn` + Tab, `pipe` + Tab, etc.)
- Auto-closing brackets and quotes
- Comment toggling with `Ctrl+/`

**Installation:**
```bash
cd vscode-stroum
chmod +x install.sh
./install.sh
```

Then reload VS Code and open any `.stm` file. See [vscode-stroum/README.md](vscode-stroum/README.md) for details.

## Transpiler Output

The transpiler generates async TypeScript code with:
- All function calls as `await` expressions
- Parallel composition (PP) as `Promise.all`
- Stream routing via runtime library
- Outcome matching with runtime checks
- On handlers for contingency stream management

## Running Tests

```bash
npm test
```

## Language Features (from spec)

Stroum is:
- **Functional** — no mutation, no loops, no classes
- **Pipe-first** — primary composition via `|>`
- **Stream-oriented** — every computation emits to named string channels
- **Immutable** — all bindings are single-assignment
- **Declarative** — primary expression + contingency handlers

### Key Operators

| Operator | Meaning |
|----------|---------|
| `\|>` | Pipe (pass left as first arg to right) |
| `\|?>` | Partial gathering pipe |
| `PP` | Parallel composition |
| `XX` | Stream termination |
| `@"name"` | Emit to named stream |
| `@>"name"` | Redirect onto stream |
| `~>` | Emission contract declaration |
| `=>` | Function/lambda body separator |

### Syntax Examples

```stroum
-- Pure function
f:double n => multiply(n, 2)

-- Multi-path function with streams
f:fetch_user id ~> @"found", @"not_found" =>
  lookup(id) @"found"
  | .empty => @"not_found"

-- Pipe chain
nums |> filter(|:v| => gt(v, 0)) |> map(|:v| => multiply(v, 2)) @"ok"

-- Parallel composition
fetch(url_a) PP fetch(url_b) |> merge @"ok"
| .fail => log() @"errors"

-- On handlers
on @"errors" |> |:e| => store(e) @"audit"
```

## Standard Library

Stroum includes a comprehensive standard library with utility functions for common tasks. See [stdlib/README.md](stdlib/README.md) for complete documentation.

### Quick Example

```stroum
f:demo => add(10, 5) |> mul(2) |> debug("Result")

demo()  -- Output: [DEBUG Result]: 30
```

### Available Functions

- **Math**: add, sub, mul, div, mod, pow, abs, min, max
- **Comparison**: eq, neq, gt, gte, lt, lte
- **Strings**: concat, upper, lower, trim, split, join
- **Lists**: map, filter, reduce, head, tail, reverse
- **I/O**: print, debug, trace
- **More**: See [stdlib/README.md](stdlib/README.md)

## Testing

### Built-in test framework

Stroum has a first-class test framework. Test files use the `.test.stm` extension and contain `test` declarations:

```stroum
test "add two numbers" =>
  assert_eq(add(2, 3), 5)

test "concat joins strings" =>
  assert_eq(concat("hello", " world"), "hello world")

test "error is thrown on bad input" =>
  assert_raises(|:_| => error("boom"))
```

Run them with:
```bash
stroum test                          # all *.test.stm files (recursive)
stroum test examples/core.test.stm   # single file
```

**Assertion functions** (available globally, no import needed):

| Function | Description |
|---|---|
| `assert(cond)` | Fails if `cond` is falsy |
| `assert_eq(left, right)` | Structural equality — shows diff on failure |
| `assert_neq(left, right)` | Fails if values are equal |
| `assert_contains(collection, item)` | String substring or list membership |
| `assert_raises(fn)` | Fails if `fn` does not throw |

Each `test` block runs in isolation — bindings in one test are invisible to others.

### Compiler test suite

The compiler's own tests use Jest:

```bash
npm test
```

## Project Structure

```
stroum/
├── src/
│   ├── types.ts               # Token type definitions
│   ├── ast.ts                 # AST node types
│   ├── lexer.ts               # Lexical analyzer ✓
│   ├── lexer.test.ts          # Lexer unit tests ✓
│   ├── lexer-integration.test.ts  # Full syntax tests ✓
│   ├── parser.ts              # Parser (AST generation) ✓
│   ├── parser.test.ts         # Parser tests ✓
│   ├── validator.ts           # Semantic analyzer ✓
│   ├── validator.test.ts      # Validator tests ✓
│   ├── transpiler.ts          # TypeScript code generator ✓
│   ├── transpiler.test.ts     # Transpiler tests ✓
│   ├── runtime-template.ts    # Runtime library template
│   ├── cli.ts                 # Command-line interface ✓
│   └── index.ts               # Main exports
├── examples/
│   ├── simple-exec.stm        # Basic example
│   ├── streams-demo.stm       # Stream routing example
│   └── demo.js                # E2E demonstration
├── stdlib/
│   ├── core.stm               # Standard library declarations
│   ├── stdlib-runtime.ts      # Stdlib implementations
│   ├── demo-math.stm          # Math operations demo
│   ├── test-simple.stm        # Simple stdlib test
│   └── README.md              # Stdlib documentation
├── vscode-stroum/
│   ├── syntaxes/
│   │   └── stroum.tmLanguage.json  # TextMate grammar
│   ├── snippets/
│   │   └── stroum.json        # Code snippets
│   ├── package.json           # Extension metadata
│   ├── language-configuration.json  # Language config
│   ├── install.sh             # Installation script
│   ├── test-syntax.stm        # Syntax test file
│   └── README.md              # Extension documentation
├── test-fixtures/
│   └── syntax-sketch.stm      # Complete syntax example
├── stroum-run                 # Executable runner script
├── package.json
├── tsconfig.json
├── jest.config.js
├── README.md
├── PHASE1-COMPLETE.md         # Lexer documentation
├── PHASE3-COMPLETE.md         # Validator documentation
├── PHASE4-COMPLETE.md         # Transpiler documentation
├── PHASE5-COMPLETE.md         # CLI documentation
└── RUNNER.md                  # Execution guide
```

## Documentation

- **[README.md](README.md)** - This file, getting started guide
- **[PHASE1-COMPLETE.md](PHASE1-COMPLETE.md)** - Lexer implementation details
- **[PHASE3-COMPLETE.md](PHASE3-COMPLETE.md)** - Validator specification
- **[PHASE4-COMPLETE.md](PHASE4-COMPLETE.md)** - Transpiler architecture
- **[PHASE5-COMPLETE.md](PHASE5-COMPLETE.md)** - CLI enhancements and commands
- **[RUNNER.md](RUNNER.md)** - Direct execution with stroum-run
- **[stdlib/README.md](stdlib/README.md)** - Standard library API reference
- **[vscode-stroum/README.md](vscode-stroum/README.md)** - VS Code extension guide

## License

MIT
