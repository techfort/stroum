# Stroum Module System

The Stroum module system allows you to organize code into reusable modules and import functionality from other files or the standard library.

## Table of Contents

- [Overview](#overview)
- [Import Syntax](#import-syntax)
- [Standard Library Auto-Import](#standard-library-auto-import)
- [Importing Local Files](#importing-local-files)
- [Import Types](#import-types)
- [Module Resolution](#module-resolution)
- [Circular Dependencies](#circular-dependencies)
- [Examples](#examples)

## Overview

Stroum uses the `i:` sigil to declare module imports. The import system supports:

- **Automatic stdlib import**: Core stdlib functions are available without explicit imports
- **Selective imports**: Import only specific functions you need
- **Qualified imports**: Import with an alias to avoid name conflicts
- **Local file imports**: Import functions from other `.stm` files
- **Dependency resolution**: Automatic compilation of all imported modules
- **Circular dependency detection**: Prevents infinite import loops

## Import Syntax

All imports use the `i:` sigil followed by the module path.

```stroum
i:core                      -- Import stdlib module
i:"./file.stm"              -- Import local file
i:core add, mul             -- Selective import
i:core as c                 -- Qualified import
i:"./utils.stm" as utils    -- Qualified local import
```

## Standard Library Auto-Import

The Stroum standard library (`core`) is **automatically imported** in all modules. This means you can use stdlib functions directly without an explicit import:

```stroum
f:main => 
  add(5, 3)
  |> mul(2)
  |> println()
```

All 47 stdlib functions are available by default:
- Arithmetic: `add`, `sub`, `mul`, `div`, `mod`, `pow`, `abs`, `min`, `max`
- Comparison: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`
- Logic: `and`, `or`, `not`
- Strings: `concat`, `length`, `upper`, `lower`, `trim`, `split`, `join`, `starts_with`, `ends_with`, `contains`
- Lists: `map`, `filter`, `reduce`, `head`, `tail`, `take`, `drop`, `reverse`, `sort`, `is_empty`
- I/O: `print`, `println`, `debug`, `trace`
- Type conversion: `to_string`, `to_int`, `to_float`
- Error handling: `error`, `try_catch`

### Disabling Auto-Import

If you need to define your own functions with these names, you can disable stdlib auto-import:

```bash
stroum compile myfile.stm --no-stdlib
```

## Importing Local Files

To import functions from another Stroum file, use a relative path:

```stroum
i:"./math-utils.stm"

f:main => 
  square(5)
  |> println()
```

### Module Exports

All function declarations in a module are automatically exported and can be imported by other modules:

```stroum
-- math-utils.stm
f:square x => mul(x, x)
f:cube x => mul(mul(x, x), x)
```

## Import Types

### 1. Full Import

Import all exported functions from a module:

```stroum
i:core                  -- Import all stdlib functions
i:"./utils.stm"         -- Import all functions from utils.stm
```

All functions become directly available in your code.

### 2. Selective Import

Import only specific functions:

```stroum
i:core add, mul, println
i:"./math-utils.stm" square, cube

f:main => 
  add(square(5), cube(2))
  |> println()
```

Benefits:
- Cleaner namespace (only imported functions are available)
- Explicit dependencies (easy to see what functions are used)
- Better for large modules (import only what you need)

### 3. Qualified Import

Import with an alias to avoid name conflicts:

```stroum
i:core as c
i:"./math-utils.stm" as math

f:main => 
  c:add(math:square(5), math:cube(2))
  |> c:println()
```

Benefits:
- Prevents name conflicts
- Makes it clear where functions come from
- Useful when importing multiple modules with similar function names

### 4. Mixing Import Types

You can use different import types for different modules:

```stroum
i:core add, mul, println          -- Selective stdlib import
i:"./math.stm" as math            -- Qualified local import  
i:"./strings.stm" concat, upper   -- Selective local import

f:main => 
  add(math:square(5), 10)
  |> mul(2)
  |> println()
```

## Module Resolution

The module resolver uses the following rules:

### 1. Stdlib Modules

Module names without a path prefix resolve to stdlib modules:

```stroum
i:core         -- Resolves to stdlib/core.stm
i:core as c    -- Resolves to stdlib/core.stm with alias
```

### 2. Relative Paths

Paths starting with `./` or `../` are resolved relative to the current file:

```stroum
i:"./utils.stm"          -- Same directory
i:"../shared/math.stm"   -- Parent directory
```

### 3. Absolute Paths

Absolute paths are supported but not recommended:

```stroum
i:"/home/user/project/utils.stm"
```

### 4. File Extension

The `.stm` extension can be omitted:

```stroum
i:"./utils"      -- Resolves to ./utils.stm
i:"./utils.stm"  -- Explicit extension (recommended)
```

## Circular Dependencies

The module resolver automatically detects circular dependencies and reports an error:

```stroum
-- a.stm
i:"./b.stm"

-- b.stm
i:"./a.stm"     -- ERROR: Circular dependency detected
```

Error message:
```
[stroum] Circular dependency detected:
  /path/to/a.stm -> /path/to/b.stm -> /path/to/a.stm
```

## Compilation Process

When you compile a file with imports, the compiler:

1. **Resolves all imports**: Finds and loads all imported modules
2. **Builds dependency graph**: Determines the order of dependencies
3. **Detects circular dependencies**: Fails if circular imports exist
4. **Compiles in order**: Compiles modules from dependencies to dependents
5. **Generates TypeScript**: Creates `.ts` files with proper ES6 imports

Example:

```bash
stroum compile main.stm
```

Output:
```
✓ Transpilation successful
  Main output: main.ts
  2 imported module(s) compiled
  Runtime: /path/to/stroum-runtime.ts
```

## Examples

### Example 1: Using Stdlib (Auto-Import)

```stroum
-- No imports needed - stdlib is auto-imported

f:main => 
  add(5, 3)
  |> mul(2)
  |> println()

main()
```

### Example 2: Selective Stdlib Import

```stroum
i:core add, mul, println

f:main => 
  add(5, 3)
  |> mul(2)
  |> println()

main()
```

### Example 3: Qualified Stdlib Import

```stroum
i:core as c

f:main => 
  c:add(5, 3)
  |> c:mul(2)
  |> c:println()

main()
```

### Example 4: Local File Import

```stroum
-- math-utils.stm
f:square x => mul(x, x)
f:cube x => mul(mul(x, x), x)
```

```stroum
-- main.stm
i:"./math-utils.stm"

f:main => 
  square(5)
  |> add(cube(2))
  |> println()

main()
```

### Example 5: Selective Local Import

```stroum
i:"./math-utils.stm" square, double

f:main => 
  double(5)
  |> square()
  |> println()

main()
```

### Example 6: Multiple Imports

```stroum
i:core add, mul, println
i:"./math.stm" as math
i:"./strings.stm" concat, upper

f:main => 
  add(math:square(5), 10)
  |> mul(2)
  |> println()
  
  concat("result: ", upper("done"))
  |> println()

main()
```

## Best Practices

### 1. Use Explicit Imports for Large Projects

```stroum
-- Prefer this (clear dependencies)
i:core add, mul, println

-- Over this (unclear what's being used)
i:core
```

### 2. Use Qualified Imports for Clarity

```stroum
-- Good: Clear where functions come from
i:core as c
i:"./math.stm" as math

c:add(math:square(5), 10)
```

### 3. Keep Module Files Focused

```stroum
-- math-utils.stm: Only math functions
-- string-utils.stm: Only string functions
-- main.stm: Application logic
```

### 4. Avoid Circular Dependencies

```stroum
-- Bad: a.stm imports b.stm, b.stm imports a.stm
-- Good: Extract shared code to a third module
```

### 5. Use Relative Paths

```stroum
-- Prefer this (portable)
i:"./utils.stm"

-- Over this (hard-coded path)
i:"/home/user/project/utils.stm"
```

## TypeScript Integration

When compiled, Stroum imports become TypeScript ES6 imports:

```stroum
i:core add, mul, println
i:"./math-utils.stm"
```

Compiles to:

```typescript
import { add, mul, println } from './stdlib-runtime';
import { square, cube, double, triple } from './math-utils';
```

All imported functions are properly resolved at compile time.

## Error Messages

### Module Not Found

```
[stroum] Module resolution error: Cannot find module "./utils.stm"
  Searched: /path/to/utils.stm
  From: /path/to/main.stm
```

### Function Not Found

```
[error] at main.stm:5, col 3: Function 'sqrt' not found in module './math.stm'
```

### Circular Dependency

```
[stroum] Circular dependency detected:
  /path/to/a.stm -> /path/to/b.stm -> /path/to/a.stm
```

### Import Resolution Failed

```
[error] at main.stm:1, col 1: Failed to resolve import: Module file not found: /path/to/missing.stm
```

## Migration Guide

If you have existing Stroum code that relies on global mock functions (from the old `stroum-run` script), you should update your code to use proper imports:

### Before (Global Mocks)

```stroum
-- Relied on global mocks from stroum-run
f:main => 
  add(5, 3)
  |> mul(2)
  |> print()
```

### After (Module System)

```stroum
-- Stdlib is auto-imported
f:main => 
  add(5, 3)
  |> mul(2)
  |> println()

main()
```

No changes needed! The stdlib is automatically available.

## Further Reading

- [Standard Library Reference](STDLIB.md) - All stdlib functions documented
- [Language Specification](README.md) - Core language features
- [CLI Documentation](PHASE5-COMPLETE.md) - Command-line tools
- [Examples](examples/imports/) - Working import examples
