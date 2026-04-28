# Phase 5 Complete: CLI Enhancements

Phase 5 brings modern CLI features and improved developer experience to the Stroum transpiler.

## Overview

The CLI has been enhanced with multiple commands, colored output, project scaffolding, and improved error reporting.

## Features

### 1. Command Structure

The CLI now supports a modern command-based interface:

```bash
stroum <command> [options]
```

**Available Commands:**

- `compile` - Transpile Stroum to TypeScript
- `run` - Compile and execute a Stroum program directly
- `init` - Initialize a new Stroum project
- `version` - Show version information
- `help` - Display help message

### 2. Colored Terminal Output

All CLI output now features ANSI colors for improved readability:

- **Errors**: Red
- **Success**: Green
- **Commands**: Cyan
- **Highlights**: Bright/Bold
- **Warnings**: Yellow

Colors automatically disable when:
- `NO_COLOR` environment variable is set
- Output is redirected to a file

### 3. Project Initialization

Create new Stroum projects with a single command:

```bash
stroum init my-project
```

This creates:
```
my-project/
├── src/
│   └── hello.stm    # Sample Stroum program
└── README.md        # Project documentation
```

The generated project includes:
- A working "Hello World" example
- Clear next steps for getting started
- Links to documentation

### 4. Direct Execution

Run Stroum programs without manual compilation:

```bash
stroum run examples/demo.stm
```

This command:
1. Transpiles the .stm file to TypeScript
2. Compiles TypeScript to JavaScript
3. Creates a runtime wrapper with built-in functions
4. Executes the program
5. Cleans up temporary files

Internally uses the `stroum-run` script for maximum compatibility.

### 5. Improved Error Messages

Error messages now include:
- Colored output for visibility
- File and line information
- Contextual help text
- Clear next steps

Example:
```
Error: duplicate binding: calculate
  at examples/demo.stm:5:3
```

### 6. Global Installation Support

The CLI can be installed globally via npm:

```bash
npm install -g
stroum --version
```

The `package.json` includes a `bin` entry:
```json
{
  "bin": {
    "stroum": "./dist/cli.js"
  }
}
```

## CLI Reference

### compile

Transpile Stroum to TypeScript.

```bash
stroum compile <file.stm> [options]
```

**Options:**
- `-o, --output <file>` - Specify output file (default: input.ts)
- `--ast` - Dump AST as JSON instead of compiling

**Examples:**
```bash
stroum compile app.stm
stroum compile app.stm -o build/app.ts
stroum compile app.stm --ast > ast.json
```

**Output:**
- `<output>.ts` - Transpiled TypeScript code
- `stroum-runtime.ts` - Runtime support library (in same directory)

### run

Compile and execute a Stroum program.

```bash
stroum run <file.stm>
```

**Example:**
```bash
stroum run examples/demo.stm
```

**Process:**
1. Creates temporary directory
2. Transpiles to TypeScript
3. Compiles to JavaScript
4. Wraps with runtime functions
5. Executes with Node.js
6. Cleans up temporary files

### init

Initialize a new Stroum project.

```bash
stroum init [name]
```

**Arguments:**
- `name` - Project name (default: "my-stroum-project")

**Example:**
```bash
stroum init my-app
cd my-app
stroum run src/hello.stm
```

**Generated Structure:**
```
my-app/
├── src/
│   └── hello.stm     # Sample program with:
│                     #   - main() function
│                     #   - Pipe operations
│                     #   - Comments
└── README.md         # Getting started guide
```

### version

Show version information.

```bash
stroum version
```

**Output:**
```
Stroum v1.0.0
Node v24.10.0
```

**Aliases:**
- `stroum -v`
- `stroum --version`

### help

Display CLI help message.

```bash
stroum help
```

**Aliases:**
- `stroum -h`
- `stroum --help`
- `stroum` (no arguments)

## Implementation Details

### Architecture

**File:** `src/cli.ts`

**Key Components:**

1. **Color Support** (`colors` object)
   - ANSI escape codes
   - NO_COLOR environment variable check
   - `colorize(text, color)` helper function

2. **Command Functions**
   - `compileCommand(args)` - Handles transpilation
   - `runCommand(args)` - Spawns stroum-run subprocess
   - `initCommand(args)` - Creates project structure
   - `showVersion()` - Displays version
   - `showHelp()` - Shows usage information

3. **Main Router** (`main()`)
   - Command-line argument parsing
   - Command dispatching
   - Error handling

### Pipeline Integration

The CLI orchestrates the full compilation pipeline:

```
Stroum Source (.stm)
    ↓
Lexer (tokenization)
    ↓
Parser (AST generation)
    ↓
Validator (semantic analysis)
    ↓
Transpiler (TypeScript generation)
    ↓
TypeScript Output (.ts)
```

Each phase reports errors and warnings with colored, formatted output.

### Dependencies

**Built-in Modules:**
- `fs` - File system operations
- `path` - Path manipulation
- `child_process.spawn` - Subprocess execution

**Project Modules:**
- `lexer` - Tokenization
- `parser` - AST generation  
- `validator` - Semantic analysis
- `transpiler` - Code generation

## Testing

### Manual Testing

Test all commands:

```bash
# Help and version
npm run dev -- help
npm run dev -- version

# Project creation
npm run dev -- init test-project
cd test-project
npm run dev -- compile src/hello.stm

# Compilation
npm run dev -- compile ../examples/simple-exec.stm
npm run dev -- compile ../examples/simple-exec.stm --ast

# Execution
npm run dev -- run ../examples/simple-exec.stm
npm run dev -- run ../examples/streams-demo.stm
```

### Build Testing

Test the compiled CLI:

```bash
npm run build
node dist/cli.js help
node dist/cli.js version
node dist/cli.js compile examples/simple-exec.stm
```

### Global Installation Testing

```bash
npm install -g .
stroum --version
stroum init test-global
cd test-global
stroum run src/hello.stm
npm uninstall -g stroum
```

## Future Enhancements

Potential additions for future phases:

1. **Watch Mode** - Auto-recompile on file changes
   ```bash
   stroum compile app.stm --watch
   ```

2. **Verbose Mode** - Show detailed compilation steps
   ```bash
   stroum compile app.stm --verbose
   ```

3. **Error Formatting** - Show source code context
   ```
   Error: duplicate binding: calculate
     → examples/demo.stm:5:3
     |
   5 | fn calculate(x: Int) -> Int {
     |    ^^^^^^^^^
     | binding already declared at line 3
   ```

4. **Configuration File** - Project-level settings
   ```json
   {
     "stroum": {
       "outDir": "dist",
       "runtime": "inline",
       "strict": true
     }
   }
   ```

5. **REPL Mode** - Interactive evaluation
   ```bash
   stroum repl
   ```

6. **Language Server** - IDE integration
   - Syntax highlighting
   - Auto-completion
   - Inline errors
   - Go to definition

## Summary

Phase 5 transforms Stroum from a basic transpiler into a polished developer tool with:

- ✅ Modern command structure
- ✅ Colored terminal output
- ✅ Project scaffolding
- ✅ Direct execution
- ✅ Global installation support
- ✅ Improved error messages

The CLI provides an excellent foundation for future enhancements and makes Stroum accessible to developers of all skill levels.
