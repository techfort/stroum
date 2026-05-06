A concrete Stroum proposal could be split into a conservative design that fits the language as it exists today, and a more ambitious design that makes ingestion a first-class concept.

**Conservative Design**

Keep ingestion as ordinary functions, but add explicit runtime lifetime declarations at the top level.

Core idea:
- Finite sources stay as normal calls: `read_csv`, `read_json`, `read_file`, `fetch_json`
- Continuous sources use `watch_*` or `listen_*`
- Program lifetime is controlled explicitly with a top-level clause such as `run until ...`

Example:

```stroum
i:io

watch_file("watched.txt") |> parse_line @ "changes"

route @"changes" |> println

run until signal
```

Recommended lifetime forms:
- `run until signal`
- `run until @"shutdown"`
- `run until timeout(5m)`
- `run forever`

Semantics:
- No `run until ...` means the program is finite and exits when primary expressions and queued stream work complete.
- `run until signal` means keep the runtime alive for open-ended sources until `SIGINT` or `SIGTERM`.
- `run until @"shutdown"` means any handler can terminate the program by emitting to that stream.
- `run forever` is explicit and should be used sparingly.

This is the least disruptive option because it does not require new source declarations or new core abstractions. It just makes liveness visible.

**Ambitious Design**

Introduce first-class source declarations.

Core idea:
- A source is a declared ingestion endpoint
- Sources declare both what they ingest and whether they are finite or open-ended
- The runtime can inspect sources and know whether the program should stay alive

Example:

```stroum
source file("orders.csv") as @"orders" finite
source watch_file("watched.txt") as @"changes" open
source http_server(8080, "/webhook") as @"events" open

route @"orders"  |> normalize_order |> store_order
route @"changes" |> parse_line |> println
route @"events"  |> validate_event |> handle_event

run until signal
```

This gives Stroum a real ingestion vocabulary:
- `source ... as @"name"`
- `finite` or `open`

That would be much clearer in larger programs, especially once multiple sources exist at once.

**Recommended Native Source Families**

If Stroum gets native ingestion, I would group them like this.

Finite:
- `file(path)`
- `glob(pattern)`
- `stdin()`
- `http_get(url)`
- `db_query(conn, sql)`
- `s3_object(bucket, key)`

Open-ended:
- `watch_file(path)`
- `watch_dir(path)`
- `http_server(port, route)`
- `websocket(url)`
- `kafka(topic)`
- `redis_stream(name)`
- `timer(interval)`
- `cron(spec)`

That naming keeps the distinction obvious:
- `read_*` or `file(...)` means bounded ingestion
- `watch_*`, `listen_*`, `server(...)`, `topic(...)` means open-ended ingestion

**Best Runtime Model**

I would recommend these rules.

1. Finite is the default.
2. Open-ended sources do not implicitly keep the program alive forever.
3. A program with open-ended sources must declare a runtime policy.
4. The runtime policy must be top-level and explicit.

That means this should be valid:

```stroum
watch_file("watched.txt") |> parse_line @ "changes"
run until signal
```

And this should be rejected or warned on:

```stroum
watch_file("watched.txt") |> parse_line @ "changes"
```

Reason:
- The program has an open-ended source
- No lifetime policy is declared
- The user should not have to guess whether it exits or hangs

**Minimal Syntax Recommendation**

If you want the simplest useful version, I would start with just this:

```stroum
watch_file("watched.txt") |> parse_line @ "changes"

route @"changes" |> println

run until signal
```

and also:

```stroum
listen_http(8080) |> parse_request @ "requests"

route @"requests" |> handle_request

run until @"shutdown"
```

That gives you:
- native-feeling continuous ingestion
- explicit event-loop lifetime
- no large grammar expansion

**What I’d Avoid**

I would avoid making “continuousness” implicit in the ingestion function alone. For example, this is weaker:

```stroum
watch_file("watched.txt") |> parse_line @ "changes"
```

because it hides the most operationally important fact: this is now a long-running program.

I would also avoid making open-ended behavior purely a CLI option. It belongs in the source because it changes the meaning of the program.

**Recommendation**

My recommendation is:

1. Start with `run until ...` as a top-level construct.
2. Standardize naming:
   `read_*` for finite, `watch_*` or `listen_*` for open-ended.
3. Later, if ingestion becomes central to the language, add first-class `source` declarations.

That gives Stroum an explicit liveness model without overdesigning the first iteration.

If you want, I can next write:
1. a draft mini-spec for `run until ...`
2. a concrete syntax proposal for `watch_file`, `listen_http`, and `timer`
3. example Stroum programs showing finite vs open-ended ingestion side by side
