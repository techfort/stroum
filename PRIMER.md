# Stroum Language Primer

Stroum is a functional, pipe-first, stream-oriented language that transpiles to TypeScript. Programs are written as pipelines of transformations; side effects and branching are handled through named streams.

---

## Table of Contents

1. [Module Structure](#1-module-structure)
2. [Functions](#2-functions)
3. [Bindings](#3-bindings)
4. [The Pipe Operator](#4-the-pipe-operator)
5. [Stream Emission](#5-stream-emission)
6. [Stream Handlers](#6-stream-handlers)
7. [Route Declarations](#7-route-declarations)
8. [Source, Stream, and Sink Declarations](#8-source-stream-and-sink-declarations)
9. [Tagged Values](#9-tagged-values)
10. [Conditionals](#10-conditionals)
11. [Lambdas](#11-lambdas)
12. [Parallel Composition](#12-parallel-composition)
13. [Structs](#13-structs)
14. [Imports](#14-imports)
15. [Standard Library](#15-standard-library)
16. [Testing](#16-testing)
17. [Developer Tools](#17-developer-tools)

---

## 1. Module Structure

Every Stroum file follows a strict top-to-bottom order:

```
imports          (i:)
definitions      (f:, s:, :bindings)
primary expressions
stream handlers  (on, route)
```

There can be **multiple** primary expressions — each runs sequentially as the program entry point. Stream handlers are declared after all primary expressions.

```stroum
-- imports
i:"./utils.stm"

-- definitions
f:double x => mul(x, 2)

-- primary expressions (run the program, in order)
double(21) |> println
double(5) |> println

-- stream handlers
on @"error" |> |:e| => println(e)
```

---

## 2. Functions

Functions are declared with the `f:` sigil.

```stroum
f:name param1 param2 => body
```

### Numeric literals

Integer and float literals may be negative — the minus sign is part of the literal, not a unary operator.

```stroum
:x -42
:pi -3.14

f:negate n => mul(n, -1)
```

### String literals and escape sequences

| Escape | Meaning |
|---|---|
| `\n` | Newline |
| `\t` | Tab |
| `\r` | Carriage return |
| `\\` | Literal backslash |
| `\"` | Literal double-quote |
| `\0` | Null character |

```stroum
write_file("/tmp/out.txt", "line one\nline two\n")
println("column\tone\ttwo")
```

String interpolation uses `#{}`:

```stroum
:name "Alice"
println("Hello, #{name}!")
```

---

### Single expression body

```stroum
f:greet name => concat("Hello, ", name)

f:square x => mul(x, x)
```

### Indented body (multiple statements)

Indent the body to sequence bindings and expressions. The last expression is the return value. Pipes must be written **inline** on a single line — `|>` cannot start a continuation line.

```stroum
f:process x =>
  :step add(x, 1)
  :scaled mul(step, 2)
  to_string(scaled)
```

Each line is a separate statement. Use intermediate bindings to break long computations across lines, or write the full pipeline inline:

```stroum
f:process x => add(x, 1) |> mul(2) |> to_string
```

### Recursive functions

Use the `rec` keyword before `f:` to allow self-reference.

```stroum
rec f:factorial n =>
  if eq(n, 0) then 1
  else mul(n, factorial(sub(n, 1)))
```

### Zero-argument functions

Zero-arg functions act as named actions or entry points.

```stroum
f:run =>
  println("starting...")
  |> process(42)
  |> println

run()
```

### Emission contracts

Declare which streams a function may emit on using `~>`.

```stroum
f:validate x ~> @"ok", @"fail" =>
  if gt(x, 0) then x @ "ok" else x @ "fail"
```

---

## 3. Bindings

Bindings are immutable values declared with `:` (or the explicit `b:` sigil).

```stroum
:threshold 100
:message "Hello, World"
:items [1, 2, 3, 4, 5]
```

Bindings are available to all subsequent definitions and the primary expression.

---

## 4. The Pipe Operator

`|>` is the central operator in Stroum. It threads values through a sequence of transformations.

> **Syntax rule:** Pipes are always written inline on a single line. `|>` cannot appear at the start of a continuation line.

### Form 1 — Bare name (idiomatic)

When a function needs only the piped value as its argument, write just the function name. No brackets.

```stroum
"hello world" |> println

42 |> to_string |> println

items |> head |> to_string |> println
```

This is the **idiomatic Stroum style**. Always prefer bare names in pipes.

### Form 2 — Placeholder `_`

When a function needs the piped value *plus* extra arguments, use `_` to mark where the piped value goes.

```stroum
items |> map(_, double)        -- double each item
value |> add(_, 10)            -- add 10 to value
str   |> concat(_, " world")   -- append to string
```

`_` can appear in any argument position.

```stroum
value |> clamp(0, _, 100)      -- clamp between 0 and 100
```

> **Note:** A call with arguments but **no** `_` in a pipe position is a compile error. To call a function independently, write it as its own top-level statement.

### Chaining example

```stroum
f:pipeline input =>
  input
  |> validate        -- bare name: validate(input)
  |> add(_, 1)       -- placeholder: add(validated, 1)
  |> to_string       -- bare name: to_string(result)
  |> println         -- bare name: println(str)
```

---

## 5. Stream Emission

The `@` operator emits a value onto a named stream **and returns the emitted value** (tee semantics). The pipe chain continues with the same value after emission.

```stroum
value @ "results"
```

Because `@` returns the value, you can chain additional pipe stages or emit to multiple streams:

```stroum
value @ "audit" @ "results"            -- emit to two streams in sequence
value @ "audit" |> transform           -- emit then continue the pipeline
```

Use `if/then/else` to route to different streams conditionally.

```stroum
f:validate x =>
  if gt(x, 0) then x @ "ok" else x @ "fail"
```

### Dynamic stream names

Stream names can be stored in bindings and referenced by name — the name resolves at runtime.

```stroum
:ok "ok"
:fail "fail"

result @ ok       -- emits to the stream named by the binding
result @ fail
```

This also works for fan-out with mixed static and dynamic names:

```stroum
result @ (ok, "audit")    -- one dynamic, one static
```

Fan-out to multiple streams:

```stroum
value @ ("audit", "results")
```

### Sequencing independent emissions

Write independent emissions as separate top-level statements:

```stroum
process(a) @ "stream-a"
process(b) @ "stream-b"
```

---

## 6. Stream Handlers

`on` subscribes a lambda to a named stream. Handlers are declared after the primary expression.

```stroum
on @"results" |> |:value| => println(to_string(value))

on @"error"   |> |:e|     => println(concat("Error: ", e))
```

The lambda receives the emitted value. The handler body can be any expression, including another emission — enabling feedback loops.

```stroum
on @"negative" |> |:x| => validate(negate(x))
-- if validate re-emits on @"ok", that handler fires next
```

**Handlers are awaited in sequence.** When a handler emits on another stream, that stream's full handler chain resolves before execution continues.

---

## 7. Route Declarations

`route` declares a **continuation pipeline** for a stream. The emitted value becomes the first argument to the pipeline. This is the idiomatic way to express a happy path.

```stroum
route @"ok" |> process |> save |> println
```

Equivalent to writing an `on` handler with a lambda, but reads as a pipeline declaration.

### Dynamic stream names in route

Like `@`, route accepts a binding reference instead of a string literal:

```stroum
:ok "ok"

route @ ok |> process |> save
```

### Happy path + rescue pattern

```stroum
-- Entry point emits success or failure
f:validate x =>
  if gt(x, 0) then x @ "ok" else x @ "fail"

validate(input)

-- Happy path: ok values flow through the processing pipeline
route @"ok" |> transform |> save

-- Rescue: fix the value and re-inject into @"ok"
on @"fail" |> |:x| => negate(x) @ "ok"
```

Because `emit` is async and awaited, when the `@"fail"` handler re-emits on `@"ok"`, the route pipeline for `@"ok"` fully completes before execution continues.

---

## 8. Source, Stream, and Sink Declarations

Stroum has three first-class sigil declarations for wiring data pipelines:

| Sigil | Role |
|-------|------|
| `stream:name Type` | Declare a typed named stream |
| `src: @"name" expr` | Open a data source and route its output to a stream |
| `snk: @"name" handler` | Subscribe a sink handler to a stream |

### `stream:` — Typed stream declaration

Declares a named stream and its value type. Optional but recommended — enables metadata tracking via `stream_info`.

```stroum
stream:raw     Any
stream:cleaned Float
stream:errors  String
```

### `src:` — Data source

Connects a data source to a stream. Two forms:

**Finite source** — reads once and emits a single value:

```stroum
src: @"orders" file("orders.csv")
```

**Open-ended (callback) source** — emits multiple times until stopped; requires `run until` to bound the program:

```stroum
src: @"changes" watch_file("data.csv")
src: @"lines"   read_records("data.csv")         -- one record per line
src: @"fields"  read_records("data.csv", ",")    -- comma-separated records

run until signal
```

### `snk:` — Sink handler

Subscribes a handler function to a stream. Equivalent to `on @"name" |> handler` but more explicit about intent.

```stroum
snk: @"orders.clean"  persist_order             -- bare name
snk: @"audit"         append_file("log.txt", _) -- placeholder form
snk: @"events"        jsonl_sink("events.jsonl") -- sink factory
snk: @"discard"       null_sink                  -- discard all values
```

### Stream metadata

Call `stream_info` to inspect a stream's runtime metadata:

```stroum
stream_info("orders")
-- returns { type: "Any", count: 42, lastValue: ..., firstEmitAt: 1716000000000 }
```

### Complete wiring example

```stroum
i:io

stream:raw   Any
stream:clean Any

src: @"raw"   watch_file("input.csv")
snk: @"clean" persist_order

route @"raw" |> validate |> normalise
on @"raw" |> |:v:Any| => v @ "clean"

run until signal
```

---

## 9. Tagged Values

Tagged values attach a named outcome label to a result. This is Stroum's typed branching mechanism — the functional equivalent of discriminated unions (F# Result, Elixir tagged tuples).

### Producer: `.tag value`

Wrap any value with a tag using the `.` prefix:

```stroum
.ok 42             -- produces { outcome: "ok", value: 42 }
.fail "not found" -- produces { outcome: "fail", value: "not found" }
```

Tags are plain identifiers. For multi-word tags, use a string literal:

```stroum
."just right" x
."too hot" temp
```

### Consumer: `| .tag => handler`

Match on outcome tags with the `|` operator. The handler receives the **unwrapped inner value**:

```stroum
evaluate(score)
| .distinction => on_distinction    -- on_distinction receives the score, not the wrapper
| .pass        => on_pass
| .fail        => on_fail
```

Handlers follow the same rules as pipe stages:
- Bare name: `| .ok => println` → `println(innerValue)`
- Placeholder: `| .ok => format(_, "pts")` → `format(innerValue, "pts")`
- Lambda: `| .fail => |:n| => println(concat("Failed: ", to_string(n)))`

### Producer in functions

```stroum
f:evaluate score =>
  if gte(score, 90) then .distinction score
  else if gte(score, 70) then .pass score
  else .fail score
```

### Tagging inside conditionals with stream emit

Tags compose with stream emission — emit the tagged value for downstream stream handlers to match on:

```stroum
f:classify x =>
  if gt(x, 0) then .positive x @ "results"
  else .negative x @ "results"
```

### Stream routing with tagged values

A tagged value can be emitted wholesale onto a stream. A `route` handler or a dispatch function pattern-matches the tag:

```stroum
f:dispatch result =>
  result
  | .distinction => on_distinction
  | .pass        => on_pass
  | .fail        => on_fail

-- Emit tagged values onto a stream
evaluate(85) @ "scores"
evaluate(38) @ "scores"

-- The route picks up each tagged value and dispatches by outcome
route @"scores" |> dispatch
```

Because `dispatch` receives a tagged value and matches on it, it works identically whether called inline or as a route target.

---

## 10. Conditionals

```stroum
if condition then expr else expr
```

Conditionals are expressions — they produce a value.

```stroum
f:sign x => if gt(x, 0) then 1 else -1

f:abs x => if gt(x, 0) then x else mul(x, -1)
```

Chain with `else if`:

```stroum
f:classify n =>
  if gt(n, 100) then "large"
  else if gt(n, 10) then "medium"
  else "small"
```

Conditionals can route to streams:

```stroum
f:route_by_sign x =>
  if gt(x, 0) then x @ "positive" else x @ "negative"
```

---

## 11. Lambdas

Lambdas are anonymous functions written inline with `|:params| => body`.

```stroum
|:x| => mul(x, 2)

|:a, :b| => add(a, b)
```

They are passed as arguments to higher-order functions:

```stroum
items |> map(_, |:x| => mul(x, 10))

nums  |> filter(_, |:n| => gt(n, 0))

pairs |> reduce(_, 0, |:acc, :x| => add(acc, x))
```

---

## 12. Parallel Composition

`PP` runs two or more expressions concurrently and gathers results.

```stroum
fetch(urlA) PP fetch(urlB) |> merge
```

The gather pipe `|>` receives a list of all branch results.

```stroum
validate(a) PP validate(b) PP validate(c) |> all_results
```

---

## 13. Structs

Structs are named record types declared with `s:`.

```stroum
s:User {
  name: String
  age:  Int
}
```

Instantiate with a record literal:

```stroum
:user User { name: "Alice", age: 30 }
```

Access fields with postfix dot syntax:

```stroum
f:is_adult user => gt(user.age, 18)
```

---

## 14. Imports

The `i:` sigil imports functions from the stdlib or local files.

```stroum
-- core stdlib is auto-imported; explicit import also works
i:core

-- import specific functions
i:core add, mul, println

-- import with alias
i:core as std

-- import local file
i:"./utils.stm"
i:"./utils.stm" as utils
```

### Optional stdlib modules

The following modules are **not** auto-imported. Add the corresponding `i:` declaration to opt in.

| Module | Import | Purpose |
|---|---|---|
| `io` | `i:io` | File system, path operations, streaming file sources |
| `process` | `i:process` | Shell commands, environment, process control |
| `timer` | `i:timer` | Delays, timestamps, elapsed time |
| `formats` | `i:formats` | CSV/JSON parsing and schema inference |

```stroum
i:io
i:process
i:timer

write_file("/tmp/out.txt", "Hello\n") |> println
exec("ls /tmp") |> println
now() |> to_string |> println
```

---

## 15. Standard Library

### `core` — auto-imported

| Category | Functions |
|---|---|
| Arithmetic | `add`, `sub`, `mul`, `div`, `mod`, `pow` |
| Math | `abs`, `min`, `max` |
| Comparison | `eq`, `neq`, `gt`, `gte`, `lt`, `lte` |
| Logic | `and`, `or`, `not` |
| Strings | `concat`, `length`, `upper`, `lower`, `trim`, `split`, `join`, `starts_with`, `ends_with`, `contains` |
| Lists | `map`, `filter`, `reduce`, `head`, `tail`, `take`, `drop`, `reverse`, `sort`, `is_empty` |
| I/O | `print`, `println`, `debug`, `trace` |
| Sinks | `null_sink`, `log_sink` |
| Streams | `stream_info` |
| Type conversion | `to_string`, `to_int`, `to_float` |
| Error handling | `error`, `try_catch` |
| Test assertions | `assert`, `assert_eq`, `assert_neq`, `assert_contains`, `assert_raises` |

### `io` — `i:io`

| Function | Signature | Description |
|---|---|---|
| `read_file` | `path` | Read file contents as a string |
| `write_file` | `path content` | Write string to file; returns `path` |
| `append_file` | `path content` | Append string to file; returns `path` |
| `file_exists` | `path` | Returns boolean |
| `delete_file` | `path` | Delete file; returns `path` |
| `list_dir` | `path` | Returns list of entry names |
| `make_dir` | `path` | Create directory recursively; returns `path` |
| `read_lines` | `path` | Read file as list of lines |
| `write_lines` | `path lines` | Write list of lines to file; returns `path` |
| `path_join` | `base part` | Join two path segments |
| `path_basename` | `path` | File name component |
| `path_dirname` | `path` | Directory component |
| `path_ext` | `path` | File extension (e.g. `.txt`) |
| `watch_file` | `path callback` | Call `callback` with file contents on each change |
| `read_records` | `path [sep]` | Stream file records one at a time; default separator `\n` |
| `file_sink` | `path` | Sink factory — appends each stream value as a string |
| `jsonl_sink` | `path` | Sink factory — appends each stream value as a JSON line |
| `http_sink` | `url` | Sink factory — POSTs each stream value as JSON; throws on non-2xx |

### `process` — `i:process`

| Function | Signature | Description |
|---|---|---|
| `exec` | `cmd` | Run shell command; returns trimmed stdout |
| `exec_lines` | `cmd` | Run shell command; returns stdout as list of lines |
| `env_get` | `name` | Get env variable; throws if unset |
| `env_get_or` | `name fallback` | Get env variable with default |
| `env_keys` | — | List all env variable names |
| `cwd` | — | Current working directory |
| `exit_process` | `code` | Exit the process with a numeric code |

### `timer` — `i:timer`

| Function | Signature | Description |
|---|---|---|
| `sleep` | `ms` | Pause execution for `ms` milliseconds |
| `now` | — | Current time as milliseconds since epoch |
| `timestamp` | — | Current time as ISO 8601 string |
| `elapsed` | `start` | Milliseconds since `start` (from `now()`) |
| `format_date` | `ms locale` | Format epoch ms as a locale date string |

### `debug`

`debug(value, label)` prints `[DEBUG label]: value` and returns `value` — useful for inspecting values mid-pipeline without breaking the chain.

```stroum
items |> debug(_, "before filter") |> filter(_, positive)
```

---

## 16. Testing

Test files use the `.test.stm` extension. Each `test` declaration is a labelled block that runs independently — bindings in one test are invisible to others.

### Basic tests

```stroum
test "add works" =>
  assert_eq(add(2, 3), 5)

test "upper converts case" =>
  assert_eq(upper("hello"), "HELLO")
```

### Binding locals inside a test

```stroum
test "pipeline result is correct" =>
  :raw "  hello world  "
  :result upper(trim(raw))
  assert_eq(result, "HELLO WORLD")
```

### Testing errors

```stroum
test "error is thrown on bad input" =>
  assert_raises(|:_| => error("expected"))
```

### Assertion reference

| Assertion | Passes when |
|---|---|
| `assert(cond)` | `cond` is truthy |
| `assert_eq(left, right)` | `left` and `right` are structurally equal |
| `assert_neq(left, right)` | `left` and `right` differ |
| `assert_contains(collection, item)` | string contains substring, or list contains item |
| `assert_raises(fn)` | calling `fn` throws (sync or async) |

All assertions are available globally — no import needed.

### Running tests

```bash
stroum test                          # all *.test.stm files (recursive)
stroum test examples/                # all tests under a path
stroum test examples/core.test.stm   # single file
```

Output: `✓`/`✗` per test with a diff on `assert_eq` failures. Exits with code 1 if any test fails.

---

## Quick Reference

```stroum
-- Function
f:name params => body

-- Recursive function
rec f:name params => body

-- Binding
:name value

-- Struct
s:Name { field: Type }

-- Pipe (bare name — idiomatic)
value |> transform |> validate |> println

-- Pipe (placeholder for extra args)
value |> add(_, 10) |> mul(_, 2)

-- Stream emit (static)
value @ "stream-name"

-- Stream emit (dynamic — name from binding)
:s "stream-name"
value @ s

-- Stream fan-out
value @ ("stream-a", "stream-b")

-- Tagged value — producer
.ok result
."multi word" result

-- Tagged value — consumer
expr
| .ok   => handler
| .fail => |:v| => println(v)

-- Conditional
if cond then a else b

-- Lambda
|:x| => mul(x, 2)

-- On handler
on @"stream" |> |:x| => handler(x)

-- Route (happy path)
route @"stream" |> step1 |> step2

-- Route (dynamic name)
route @ binding |> step1 |> step2

-- Parallel
a(x) PP b(x) |> gather

-- Import (local file)
i:"./file.stm"

-- Import optional stdlib module
i:io
i:process
i:timer

-- Stream / source / sink declarations
stream:name Type                       -- declare typed named stream
src: @"name" watch_file("f.csv")       -- open-ended callback source
src: @"name" read_records("f.csv")     -- record-per-line source
src: @"name" file("f.csv")             -- finite source (emit once)
snk: @"name" handler                   -- sink: bare name
snk: @"name" fn("arg", _)             -- sink: placeholder form
snk: @"name" jsonl_sink("out.jsonl")   -- sink: factory
stream_info("name")                    -- { type, count, lastValue, firstEmitAt }

-- Test declaration
test "label" =>
  assert_eq(fn(arg), expected)

-- Negative number literals
:x -42
:pi -3.14
f:negate n => mul(n, -1)
```

---

## 17. Developer Tools

### Format

The `stroum format` command formats a source file using the canonical AST-based formatter.

```bash
stroum format input.stm            # print formatted source to stdout
stroum format input.stm --write    # rewrite file in place
stroum format input.stm --check    # exit 1 if file needs formatting (CI use)
```

Formatting is idempotent — running it twice produces the same result as running it once.

### Watch mode

```bash
stroum run examples/demo.stm --watch
```

Re-runs the program whenever the source file changes. Uses a 300 ms debounce; kills the previous child process before restarting. Press `Ctrl+C` to stop watching.

### Source maps

`stroum compile` writes a V3 source map (`.ts.map`) alongside the generated `.ts` file. The map records which generated TypeScript line corresponds to which `.stm` line.

`stroum run` enables source maps end-to-end: it passes `--sourceMap` to the TypeScript compiler and `--enable-source-maps` to Node, so runtime stack traces point to `.stm` line numbers.

### REPL

```bash
stroum repl
```

An interactive session that evaluates Stroum expressions. Tab-completes stdlib function names and names you have defined in the current session. Use `:help` for available REPL commands.
