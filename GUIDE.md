# Stroum: A Guide

Stroum is a language for data pipelines. Not a framework layered onto a general-purpose language, not a configuration DSL bolted onto a runtime — a language, with its own syntax, type system, and compiler, that treats streams, sources, sinks, and typed data flow as first-class citizens.

This guide explains what Stroum is, what problems it solves, and what it looks like in practice. It is not a tutorial. It is a technical introduction to the ideas behind the language, illustrated with working programs.

The full syntax reference is in [REFERENCE.md](REFERENCE.md).

---

## The problem with data pipelines in general-purpose languages

Consider a straightforward data engineering task: ingest JSON events from an HTTP endpoint, validate them against a schema, route valid events by type to different storage sinks, and send invalid events to a dead-letter queue. Emit a running count of processed events.

In Python, this becomes a script. There is an HTTP polling loop. There is a try/except block around the parsing. There are if/else chains that route to different functions. There are separate imports for the metrics library, the HTTP client, the JSON serialiser. The actual logic — validate, route, sink — is buried somewhere inside the plumbing. Reading the code, you cannot immediately see the data flow. You have to read the entire file and reconstruct it in your head.

In Node.js, it is the same story, dressed in callbacks and Promises. In Java, it is a class hierarchy. In shell, it is a pipeline with no type safety and no error handling.

The problem is not that these languages are bad. It is that data pipelines are architecture, and these languages have no way to express architecture directly. You describe the computation, and the architecture is implied — hidden in the structure of the code, inferred by the reader.

Stroum inverts this. In Stroum, the pipeline is the program. You declare named streams, connect sources to them, define transformations, and wire the results to sinks. The architecture is not implied — it is written down, in the language, as declarations. Reading a Stroum program is reading its dataflow graph.

---

## Streams are the unit of architecture

In Stroum, a stream is a named, typed channel that carries values between producers and consumers. Streams are declared at the top of the program:

```stroum
stream:raw      String
stream:events   Event
stream:purchases Purchase
stream:dlq      InvalidEvent
```

This is not a library call. It is a language declaration, on par with declaring a struct or a function. The stream `events` carries values of type `Event`. The stream `dlq` carries values of type `InvalidEvent`. The type system enforces this at transpilation time.

Stream declarations serve two purposes. First, they document the architecture. A reader opening this file immediately knows what data flows through the program and what shape it has. Second, they enable runtime metadata. At any point in the program, you can call `stream_info(@events)` to get the count of values processed, the last value seen, and the timestamp of the first emission — without any instrumentation code.

---

## Sources and sinks are declarations, not registrations

In most pipeline frameworks, wiring up a data source means calling a function, passing a callback, and managing the lifecycle. In Stroum, it is a declaration:

```stroum
src: @raw  http_poll("https://events.internal/stream", 1000)
src: @raw  read_records("backfill.ndjson")
```

Both lines declare data sources that feed into the same `@raw` stream. The HTTP poller fires every second; the file reader processes the backfill records. From the pipeline's perspective, they are indistinguishable — both produce strings on `@raw`. No coordination code. No shared state. No lifecycle management.

Sinks work the same way:

```stroum
snk: @purchases  jsonl_sink("warehouse/purchases.jsonl")
snk: @pageviews  jsonl_sink("warehouse/pageviews.jsonl")
snk: @dlq        jsonl_sink("dead-letter/events.jsonl")
```

A sink is a declaration that a stream's output should be drained somewhere. The connection is made by the runtime. There is no `stream.subscribe(handler)` call, no topic registration, no event listener. The program says what should happen; the runtime wires it up.

---

## Typed outcomes replace exception handling

In most languages, a function that can fail either throws an exception or returns a nullable. Both require the caller to handle the failure case separately from the success case, in a different syntactic context — a try/catch block, a null check. The failure path is structurally different from the success path.

In Stroum, functions return tagged values:

```stroum
t:ParseResult = .ok Event | .error InvalidEvent

f:parse_event raw:String -> ParseResult =>
  :fields split(raw, "|")
  if lt(count(fields), 5) then
    .error InvalidEvent { raw: raw, reason: "insufficient fields" }
  else
    .ok Event {
      id:         nth(fields, 0),
      user_id:    nth(fields, 1),
      event_type: nth(fields, 2),
      amount:     to_float(nth(fields, 3)),
      ts:         nth(fields, 4)
    }
```

The return type is `ParseResult`, which is declared as a union: either `.ok Event` or `.error InvalidEvent`. The function cannot return a raw `Event` — it must tag its result. The caller cannot ignore the failure case — the type forces it to handle both branches.

At the call site, the branches are matched with `|`:

```stroum
route @raw |> parse_event
  | .ok    => process_event
  | .error => null_sink
```

The `.ok` branch receives the unwrapped `Event` and passes it to `process_event`. The `.error` branch receives the unwrapped `InvalidEvent`. The dead-letter queue is just another sink. No try/catch. No null checks. Both paths are first-class.

---

## Route declarations are the pipeline

In Stroum, `route` is not a function call. It is a declaration of how data flows:

```stroum
route @raw      |> parse_event
  | .ok         => record_metric |> route_by_type
  | .error      => null_sink

route @purchases |> enrich_purchase
```

Reading these two lines, you know the entire pipeline. Raw events are parsed; valid ones are metered and routed by type; invalid ones are dropped. Purchases are enriched before landing. There is no handler registration to trace, no callback chain to follow. The route declarations are the architecture documentation.

This is the core idea behind Stroum: the program is the specification of the data flow, expressed in a language that makes the architecture visible at a glance.

---

## A complete pipeline

Here is a full event ingestion pipeline. It ingests raw events from two sources — a live HTTP poll and a historical backfill file — parses them into typed structs, routes by event type, emits running metrics, and writes to per-type storage sinks. The entire thing is 65 lines.

```stroum
i:io
i:timer

-- ── Typed streams ─────────────────────────────────────────────────────────────

stream:raw        String        -- raw text from all sources
stream:events     Event         -- validated, parsed events
stream:purchases  Purchase      -- purchase events → warehouse
stream:pageviews  Pageview      -- page view events → analytics store
stream:dlq        InvalidEvent  -- failed validation → dead-letter queue

-- ── Data model ────────────────────────────────────────────────────────────────

s:Event {
  id:         String
  user_id:    String
  event_type: String
  amount:     Float
  ts:         String
}

s:Purchase {
  event_id: String
  user_id:  String
  amount:   Float
  ts:       String
}

s:Pageview {
  event_id: String
  user_id:  String
  ts:       String
}

s:InvalidEvent {
  raw:    String
  reason: String
}

t:ParseResult = .ok Event | .error InvalidEvent

-- ── Parsing and validation ────────────────────────────────────────────────────

f:parse_event raw:String -> ParseResult =>
  :fields split(raw, "|")
  if lt(count(fields), 5) then
    .error InvalidEvent { raw: raw, reason: "insufficient fields" }
  else
    .ok Event {
      id:         nth(fields, 0),
      user_id:    nth(fields, 1),
      event_type: nth(fields, 2),
      amount:     to_float(nth(fields, 3)),
      ts:         nth(fields, 4)
    }

-- ── Metrics ───────────────────────────────────────────────────────────────────
-- stream_info gives us a running count with no external instrumentation.

f:record_metric e:Event -> Event =>
  :info stream_info(@events)
  println("processed=#{to_string(info.count)} last_type=#{e.event_type}")
  e

-- ── Content-based routing ─────────────────────────────────────────────────────
-- Emit to a type-specific stream; unknown types fall through and are dropped.

f:route_by_type e:Event -> Event =>
  if eq(e.event_type, "purchase") then
    Purchase { event_id: e.id, user_id: e.user_id, amount: e.amount, ts: e.ts } @purchases
  else if eq(e.event_type, "page_view") then
    Pageview { event_id: e.id, user_id: e.user_id, ts: e.ts } @pageviews
  else
    e

-- ── Sources: two feeds into one typed stream ──────────────────────────────────

src: @raw  http_poll("https://events.internal/stream", 1000)
src: @raw  read_records("backfill.ndjson")

-- ── Pipeline ──────────────────────────────────────────────────────────────────

route @raw |> parse_event
  | .ok    => record_metric |> route_by_type
  | .error => null_sink

-- ── Sinks ─────────────────────────────────────────────────────────────────────

snk: @purchases  jsonl_sink("warehouse/purchases.jsonl")
snk: @pageviews  jsonl_sink("warehouse/pageviews.jsonl")
snk: @dlq        jsonl_sink("dead-letter/events.jsonl")

run until signal
```

A few things worth noting:

**Multi-source fan-in is a non-event.** Two `src:` declarations pointing to `@raw` — one live, one historical — require no coordination code. The stream is the join point. Both sources write to it; downstream sees a single typed stream.

**The dead-letter queue is just a stream.** There is no special DLQ infrastructure. `@dlq` is a stream like any other. You declare it, sink it to a file, and that is the DLQ. If you wanted to re-drive failed events later, you would add a second source reading the dead-letter file.

**Metrics are inline.** `stream_info(@events)` returns the running count of events that have passed through `@events`. There is no metrics client to configure, no counter to register. The stream already knows how many values it has carried.

**The architecture is readable.** The `route` declarations at the bottom of the file are a complete description of the data flow. You can read them without understanding the implementation of any function and still understand what the program does.

---

## What this makes natural

Stroum is designed for programs where the data flow is the main concern. A few patterns that fall out naturally from its design:

**Fan-in from heterogeneous sources.** Any number of `src:` declarations can feed the same stream. Merging a live feed with a historical backfill, or combining events from two different APIs, is two lines of declarations.

**Dead-letter queues with typed context.** Because error paths are tagged values, every failure carries structured context — the raw input and the reason for failure. The DLQ is not a string dump; it is a typed stream of `InvalidEvent` records that can be re-processed, queried, or alarmed on.

**Content-based routing.** Routing by a field value — event type, severity level, region — is a function that emits to a named stream. The stream declarations give each route a name and a type. Adding a new event type means adding a stream declaration, a branch in the routing function, and a sink.

**Observable by default.** `stream_info` on any declared stream gives count, last value, and first emission timestamp. This is enough to build simple rate monitors and lag detectors without a metrics infrastructure.

**Pipeline as documentation.** Because the architecture is expressed in route and sink declarations rather than buried in function calls, onboarding a new engineer to a Stroum pipeline means reading the declarations at the bottom of the file, not tracing through a call graph.

---

## Where to go next

The [REFERENCE.md](REFERENCE.md) covers the complete syntax: all sigils, operators, stdlib functions, and language constructs. The `examples/` directory contains working programs including the end-to-end log pipeline in `examples/e2e/log-pipeline.stm`.

To run a program:

```bash
stroum run examples/e2e/log-pipeline.stm
```

To compile to TypeScript without running:

```bash
stroum compile examples/e2e/log-pipeline.stm
```
