# Stroum Standard Library

Version 1.0.0

## Overview

The Stroum Standard Library provides a comprehensive set of utility functions for common programming tasks including arithmetic, string manipulation, list processing, I/O operations, and more.

## Structure

```
stdlib/
├── core.stm              # Standard library function declarations
├── stdlib-runtime.ts     # TypeScript runtime implementations
├── examples.stm          # Usage examples
├── test-simple.stm       # Simple test case
└── README.md            # This file
```

## Installation

The standard library is included with Stroum. Functions are automatically available when you import the runtime.

## Usage

Import stdlib functions in your Stroum code:

```stroum
f:compute x =>
  x
    |> mul(2)
    |> add(10)
    |> debug("Result")

compute(5)  -- Output: [DEBUG Result]: 20
```

## API Reference

### Arithmetic Operations

| Function | Signature | Description | Example |
|----------|-----------|-------------|---------|
| `add` | `(a, b)` | Addition | `add(5, 3)` → `8` |
| `sub` | `(a, b)` | Subtraction | `sub(10, 3)` → `7` |
| `mul` | `(a, b)` | Multiplication | `mul(4, 5)` → `20` |
| `div` | `(a, b)` | Division | `div(20, 4)` → `5` |
| `mod` | `(a, b)` | Modulo | `mod(10, 3)` → `1` |
| `pow` | `(a, b)` | Power | `pow(2, 3)` → `8` |
| `abs` | `(n)` | Absolute value | `abs(-5)` → `5` |
| `min` | `(a, b)` | Minimum | `min(3, 7)` → `3` |
| `max` | `(a, b)` | Maximum | `max(3, 7)` → `7` |

### Comparison Operations

| Function | Signature | Description | Example |
|----------|-----------|-------------|---------|
| `eq` | `(a, b)` | Equal to | `eq(5, 5)` → `true` |
| `neq` | `(a, b)` | Not equal to | `neq(5, 3)` → `true` |
| `gt` | `(a, b)` | Greater than | `gt(7, 5)` → `true` |
| `gte` | `(a, b)` | Greater than or equal | `gte(5, 5)` → `true` |
| `lt` | `(a, b)` | Less than | `lt(3, 5)` → `true` |
| `lte` | `(a, b)` | Less than or equal | `lte(5, 5)` → `true` |

### Logic Operations

| Function | Signature | Description | Example |
|----------|-----------|-------------|---------|
| `and` | `(a, b)` | Logical AND | `and(true, false)` → `false` |
| `or` | `(a, b)` | Logical OR | `or(true, false)` → `true` |
| `not` | `(a)` | Logical NOT | `not(true)` → `false` |

### String Operations

| Function | Signature | Description | Example |
|----------|-----------|-------------|---------|
| `concat` | `(a, b)` | Concatenate strings | `concat("Hello", " World")` → `"Hello World"` |
| `length` | `(s)` | String length | `length("Hello")` → `5` |
| `upper` | `(s)` | Convert to uppercase | `upper("hello")` → `"HELLO"` |
| `lower` | `(s)` | Convert to lowercase | `lower("HELLO")` → `"hello"` |
| `trim` | `(s)` | Trim whitespace | `trim("  hi  ")` → `"hi"` |
| `split` | `(s, delim)` | Split string | `split("a,b,c", ",")` → `["a","b","c"]` |
| `join` | `(arr, delim)` | Join array | `join(["a","b"], ",")` → `"a,b"` |
| `starts_with` | `(s, prefix)` | Check prefix | `starts_with("hello", "he")` → `true` |
| `ends_with` | `(s, suffix)` | Check suffix | `ends_with("hello", "lo")` → `true` |
| `contains` | `(s, substr)` | Check substring | `contains("hello", "ell")` → `true` |

### List Operations

| Function | Signature | Description | Example |
|----------|-----------|-------------|---------|
| `map` | `(fn, list)` | Apply function to each element | `map(double, [1,2,3])` → `[2,4,6]` |
| `filter` | `(fn, list)` | Keep elements matching predicate | `filter(is_positive, [1,-2,3])` → `[1,3]` |
| `reduce` | `(fn, init, list)` | Reduce list to single value | `reduce(add, 0, [1,2,3])` → `6` |
| `head` | `(list)` | First element | `head([1,2,3])` → `1` |
| `tail` | `(list)` | All but first element | `tail([1,2,3])` → `[2,3]` |
| `take` | `(n, list)` | First n elements | `take(2, [1,2,3,4])` → `[1,2]` |
| `drop` | `(n, list)` | Skip first n elements | `drop(2, [1,2,3,4])` → `[3,4]` |
| `reverse` | `(list)` | Reverse list | `reverse([1,2,3])` → `[3,2,1]` |
| `sort` | `(list)` | Sort list | `sort([3,1,2])` → `[1,2,3]` |
| `is_empty` | `(list)` | Check if empty | `is_empty([])` → `true` |

### I/O Operations

| Function | Signature | Description | Example |
|----------|-----------|-------------|---------|
| `print` | `(value)` | Print value | `print(42)` → prints `42` |
| `println` | `(value)` | Print value with newline | `println("Hi")` → prints `Hi\n` |
| `debug` | `(value, label)` | Debug print | `debug(5, "x")` → prints `[DEBUG x]: 5` |
| `trace` | `(message)` | Trace message | `trace("Started")` → prints `[TRACE] Started` |

### Type Conversion

| Function | Signature | Description | Example |
|----------|-----------|-------------|---------|
| `to_string` | `(value)` | Convert to string | `to_string(42)` → `"42"` |
| `to_int` | `(value)` | Convert to integer | `to_int("42")` → `42` |
| `to_float` | `(value)` | Convert to float | `to_float("3.14")` → `3.14` |

### Error Handling

| Function | Signature | Description | Example |
|----------|-----------|-------------|---------|
| `error` | `(message)` | Throw error | `error("Failed")` → throws |
| `try_catch` | `(fn, fallback)` | Try/catch | `try_catch(risky, safe)` |

## Examples

### Basic Arithmetic

```stroum
f:circle_area radius =>
  radius
    |> mul(radius)
    |> mul(3.14159)

circle_area(5.0) |> print  -- 78.53975
```

### String Processing

```stroum
f:format_name first last =>
  first
    |> concat(" ")
    |> concat(last)
    |> upper()

format_name("john", "doe") |> print  -- JOHN DOE
```

### List Processing

```stroum
f:sum_squares numbers =>
  numbers
    |> map(|:n| => mul(n, n))
    |> reduce(|:acc n| => add(acc, n), 0)

-- sum_squares([1, 2, 3, 4])  -- 30 (when array literals supported)
```

### Conditional Logic

```stroum
f:classify n =>
  n
    |> gt(0)
  | .true  => print("Positive")
  | .false => print("Non-positive")

classify(5)   -- Positive
classify(-3)  -- Non-positive
```

### Debugging

```stroum
f:compute x =>
  x
    |> mul(2)
    |> debug("After doubling")
    |> add(10)
    |> debug("Final result")

compute(5)
-- Output:
-- [DEBUG After doubling]: 10
-- [DEBUG Final result]: 20
```

## Implementation Details

### Runtime Integration

All stdlib functions are implemented as async TypeScript functions in `stdlib-runtime.ts`. They follow the pattern:

```typescript
export async function __builtin_<name>(...args): Promise<ReturnType> {
  // Implementation
}
```

### Function Declarations

The `core.stm` file provides Stroum function declarations that map to the runtime implementations:

```stroum
f:add a b => __builtin_add(a, b)
```

This allows the transpiler to recognize and properly handle stdlib functions.

### Backward Compatibility

Legacy function names are supported via exports in `stdlib-runtime.ts`:

```typescript
export const multiply = __builtin_mul;
export const plus = __builtin_add;
```

This ensures existing code continues to work.

## Testing

Run the simple test:

```bash
stroum run stdlib/test-simple.stm
```

Expected output:
```
[DEBUG Result]: 20
```

## Future Extensions

Planned additions to the standard library:

- **File I/O**: `read_file`, `write_file`, `file_exists`
- **JSON**: `json_parse`, `json_stringify`
- **HTTP**: `http_get`, `http_post`
- **Date/Time**: `now`, `format_date`, `parse_date`
- **Math**: `sqrt`, `sin`, `cos`, `tan`, `log`, `exp`
- **Random**: `random`, `random_int`, `random_choice`
- **Collections**: `dict_get`, `dict_set`, `set_add`, `set_contains`

## Contributing

To add new functions to the stdlib:

1. Add the function declaration to `core.stm`
2. Implement the runtime function in `stdlib-runtime.ts`
3. Add tests and examples
4. Update this README with documentation

## License

MIT
