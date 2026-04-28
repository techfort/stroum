# Stroum Import System Examples

This directory contains examples demonstrating the Stroum module import system.

## Examples

### 01-stdlib-auto.stm
Demonstrates automatic stdlib import. All stdlib functions (add, mul, println, etc.) are available without explicit import.

```bash
stroum run 01-stdlib-auto.stm
```

### 02-selective-import.stm
Shows how to selectively import specific functions from the stdlib using `i:core add, mul, println`.

```bash
stroum run 02-selective-import.stm
```

### 03-qualified-import.stm
Demonstrates qualified imports with an alias: `i:core as c`. Functions are accessed with the alias prefix: `c:add()`, `c:mul()`, etc.

```bash
stroum run 03-qualified-import.stm
```

### 04-local-import.stm
Shows how to import functions from a local Stroum file using `i:"./math-utils.stm"`.

```bash
stroum run 04-local-import.stm
```

### 05-selective-local.stm
Demonstrates selective imports from a local file: `i:"./math-utils.stm" square, double`.

```bash
stroum run 05-selective-local.stm
```

### math-utils.stm
A reusable module containing math utility functions (square, cube, double, triple).

## Import Syntax Reference

### Full Import
```stroum
i:core                    -- Import all functions from stdlib
i:"./file.stm"            -- Import all functions from local file
```

### Selective Import
```stroum
i:core add, mul, println  -- Import only specific functions
i:"./file.stm" fn1, fn2   -- Import specific functions from local file
```

### Qualified Import
```stroum
i:core as c               -- Import with alias, use as c:add(), c:mul(), etc.
i:"./file.stm" as utils   -- Import local file with alias
```

## Features

- **Automatic Stdlib**: The core stdlib is automatically imported, so `add()`, `mul()`, etc. work without explicit imports
- **Module Resolution**: Supports relative paths (`./`, `../`) and stdlib module names (`core`)
- **Circular Dependency Detection**: Prevents infinite import loops
- **Dependency Ordering**: Modules are compiled in the correct order based on their dependencies
- **Selective Imports**: Import only the functions you need to keep namespace clean
- **Qualified Imports**: Use aliases to avoid name conflicts

## Compiling Multi-File Programs

When you compile a file that imports other modules, the compiler automatically:
1. Resolves all imports (local and stdlib)
2. Detects circular dependencies
3. Compiles modules in dependency order
4. Generates TypeScript imports in the transpiled output

```bash
stroum compile 04-local-import.stm
# This will compile both 04-local-import.stm and math-utils.stm
```

## Disabling Stdlib Auto-Import

If you want to disable automatic stdlib import (for example, to define your own `add` function), use the `--no-stdlib` flag:

```bash
stroum compile myfile.stm --no-stdlib
```
