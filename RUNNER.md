# Stroum Runner - Execute .stm Files Directly

## Usage

```bash
./stroum-run <file.stm>
```

## Examples

```bash
# Simple computation
./stroum-run examples/simple-exec.stm

# Complex program with streams
./stroum-run test-fixtures/test-case-10.stm
```

## What It Does

The `stroum-run` script provides a complete execution pipeline:

1. **Transpiles** Stroum (.stm) → TypeScript (.ts)
2. **Compiles** TypeScript → JavaScript 
3. **Executes** with built-in runtime functions

## Built-in Functions

The runner provides these functions automatically:

### Math
- `multiply(a, b)` - Multiplication
- `plus(a, b)` - Addition
- `minus(a, b)` - Subtraction
- `divide(a, b)` - Division

### Comparison
- `gt(a, b)` - Greater than
- `gte(a, b)` - Greater than or equal
- `lt(a, b)` - Less than
- `eq(a, b)` - Equal to

### I/O
- `print(value)` - Print to console
- `log(value)` - Log with [LOG] prefix

### Mock Functions
For testing, these functions return mock data:
- `fetch`, `validate`, `normalise`, `merge`, `store`, `notify`, etc.

## Example Output

```
🚀 Executing Stroum file: examples/simple-exec.stm

📝 Transpiling to TypeScript...
[stroum] Phase 4 complete: transpilation successful
📝 Compiling to JavaScript...
📝 Creating runtime wrapper...
📝 Executing...

═══════════════════════════════════════════════════════════════
                    STROUM PROGRAM OUTPUT
═══════════════════════════════════════════════════════════════

16

═══════════════════════════════════════════════════════════════
✅ Execution complete!
```

## Notes

- TypeScript compilation warnings about missing functions are expected - the runner provides them at runtime
- Temp files are automatically cleaned up after execution
- Uses the project's TypeScript compiler for compatibility
