# Stroum Development Plan

This document tracks the roadmap toward a production-ready Stroum release.
Each phase lives on its own branch and is merged when complete.

---

## Phase 6 — Source Maps `feat/source-maps` ← current

**Goal:** Every runtime error in transpiled TypeScript traces back to the correct
line and column in the original `.stm` source file.

**Why first:** Without this, debugging any non-trivial Stroum program requires
manually cross-referencing generated TypeScript with source. It also unblocks
the LSP hover and diagnostics improvements planned in Phase 9.

### Background

The AST already carries `SourceLocation { line, column }` on every node
(defined in `src/types.ts`). The transpiler's `emit()` method discards this
information — it pushes indented strings into a flat `string[]` with no record
of which output line corresponds to which input location.

Source maps (V3 format, the Node.js / browser standard) encode a mapping from
each generated line+column back to an original file+line+column. The format is
consumed natively by Node.js (`--enable-source-maps`), V8, all major browsers,
and every error-reporting tool in the JS ecosystem.

### Implementation steps

#### Step 1 — Source map encoder
Add `src/source-map.ts`: a self-contained VLQ encoder and `SourceMapBuilder`
class. No third-party dependency — the encoder is ~50 lines and keeping it
in-tree avoids a build-time dependency that must be audited.

```
SourceMapBuilder
  .addMapping(generatedLine, generatedCol, sourceLine, sourceCol)
  .serialize() → JSON string (V3 source map)
```

#### Step 2 — Thread location through `emit()`
Change the transpiler's internal `emit()` signature to accept an optional
`SourceLocation`:

```ts
private emit(line: string, loc?: SourceLocation): void
```

Each call that emits code corresponding to a known AST node passes `node.location`.
The builder records `(outputLineIndex, 0, loc.line, loc.column)` before pushing
the string. Calls that emit boilerplate (imports, runtime wiring) pass no location
and produce unmapped lines — this is correct and expected.

#### Step 3 — Emit the `.map` file
`Transpiler.transpile()` returns `{ code: string; map: string }` instead of a
plain string. The `compile` and `run` CLI commands write `<output>.map`
alongside `<output>.ts`, and append `//# sourceMappingURL=<output>.ts.map` to
the generated TypeScript.

#### Step 4 — Enable source maps at runtime
The `run` command launches the transpiled program with `--enable-source-maps`
(Node ≥ 12). Stack traces in uncaught errors and the Stroum test runner will
automatically resolve to `.stm` lines.

#### Step 5 — Tests
- Unit tests for the VLQ encoder (known encode/decode pairs)
- Snapshot test: transpile a multi-construct `.stm` fixture, assert the map
  JSON matches a stored snapshot
- Integration test: run a `.stm` program that throws, capture the stack trace,
  assert the error points to the correct `.stm` line

#### Step 6 — `derive schema` and `graph` commands
These commands don't run user code, so they don't need source maps. Document
this explicitly so it isn't revisited.

### Acceptance criteria
- `stroum run foo.stm` — uncaught errors show `.stm` filename and line
- `stroum compile foo.stm` — produces `foo.ts` + `foo.ts.map`
- `stroum test foo.test.stm` — failed assertion output shows `.stm` line
- Node `--enable-source-maps` flag is passed automatically; users do not need to set it
- No new runtime dependencies

### Key files
| File | Change |
|---|---|
| `src/source-map.ts` | New — VLQ encoder + SourceMapBuilder |
| `src/transpiler.ts` | `emit()` accepts `SourceLocation`; returns `{code, map}` |
| `src/cli.ts` | Write `.map` file; pass `--enable-source-maps` to `node` |
| `src/transpiler.test.ts` | Source map snapshot tests |

---

## Phase 7 — Error Recovery _(planned)_

**Goal:** The compiler collects and reports all errors in a single pass instead
of throwing on the first one.

The lexer and parser currently throw at the first problem. Real-world usage
(editor integration, CI) expects a full error list from a single compile.

Work involves introducing an error accumulator passed through the pipeline,
defining recovery heuristics (skip to next statement on parse error), and
updating the LSP to publish all diagnostics in one `sendDiagnostics` call.

---

## Phase 8 — Static Type System _(planned)_

**Goal:** Gradual type checking — struct field types and function signatures are
checked at compile time; unannotated code falls back to `any`.

This is the largest planned investment. Initial scope:
- Type-check function call arity and struct field assignments
- Infer return types for simple functions
- Propagate types through pipe chains
- Emit typed TypeScript (replace `any` in generated code)

Out of scope for this phase: generics, union types, full inference.

---

## Phase 9 — LSP Completion and Hover _(planned)_

**Goal:** Autocompletion for functions, struct fields, and imported names;
hover documentation; go-to-definition.

Depends on Phase 8 (type information makes completions accurate) and Phase 6
(source locations make go-to-definition precise).

---

## Phase 10 — Package Manager _(planned)_

**Goal:** `stroum add <package>` / `stroum publish` backed by a simple registry.

Minimum viable scope: resolve packages from a registry URL, pin versions in a
`stroum.lock` file, cache locally. The module resolver in `src/module-resolver.ts`
already handles local and stdlib paths — registry paths are a third resolution
strategy.

---

## Deferred / Under Evaluation

- **WASM compilation target** — Stroum's async/streaming model maps naturally
  to the JS event loop. A WASM execution target would require implementing a
  full async runtime from scratch. Currently assessed as high cost for
  uncertain gain. Re-evaluate after the type system (Phase 8) is complete.
  WASM as a *distribution target for the compiler itself* (so `stroum` runs
  without Node) is a separate, much smaller effort and may happen earlier.

- **REPL** — Interactive evaluation. Valuable for learning and data exploration
  but not blocking any other phase. Likely after Phase 7 (error recovery makes
  a REPL usable).

- **Native formatter for `.stm` files** — `stroum fmt`. Low priority while the
  language syntax is still evolving.
