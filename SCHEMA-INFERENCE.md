# Schema Inference Feature

Stroum provides automatic schema inference from structured data files (CSV and JSON), allowing you to generate struct definitions and work with external data without manual type declarations.

## Overview

Three complementary approaches are available:

1. **CLI Tool** - Generate struct definitions manually
2. **Preprocessor Macro** - Compile-time schema injection
3. **Runtime Functions** - Dynamic schema discovery and data loading

All three approaches share the same type inference engine for consistent results.

## Type Inference Rules

The inference engine analyzes sample data and infers Stroum types:

| Data Pattern | Inferred Type |
|--------------|---------------|
| Integer numbers | `Int` |
| Floating-point numbers | `Float` |
| `true`/`false` | `Bool` |
| Any other value | `String` |

**Note:** Type names must follow the "Capitalised" format (first letter uppercase, rest lowercase only). Examples: `Row`, `Person`, `Data`

## 1. CLI Tool

Generate struct definitions from the command line:

```bash
stroum derive schema <file> <struct-name>
```

### Examples

```bash
# Generate from CSV
stroum derive schema data/users.csv User

# Generate from JSON
stroum derive schema api/response.json Response

# Redirect to file
stroum derive schema data.csv Record > types.stm
```

### Output

```stroum
s:User {
  id: Int
  name: String
  email: String
  age: Int
  active: Bool
}
```

## 2. Preprocessor Macro

Inject struct definitions at compile-time using the `#derive` directive:

```stroum
#derive schema "path/to/file.csv" as StructName
```

### How It Works

1. The preprocessor runs **before** the lexer/parser
2. Detects `#derive` directives in source code
3. Reads the specified file and infers the schema
4. Replaces the directive with a generated struct definition
5. The modified source is then parsed normally

### Example

**Input file** (`examples/process-data.stm`):

```stroum
-- Load schema from CSV at compile time
#derive schema "../data/customers.csv" as Customer

f:process_customer customer:Customer => 
  println("Processing: #{customer.name}")

f:main => {
  read_csv("data/customers.csv")
  |> head
  |> process_customer
}
```

**After preprocessing** (what the parser sees):

```stroum
-- Auto-generated from: #derive schema "../data/customers.csv" as Customer
s:Customer {
  id: Int
  name: String
  email: String
  age: Int
  active: Bool
}

f:process_customer customer:Customer => 
  println("Processing: #{customer.name}")

f:main => {
  read_csv("data/customers.csv")
  |> head
  |> process_customer
}
```

### Path Resolution

Paths in `#derive` directives are resolved relative to the source file's directory:

```stroum
-- If this file is in examples/
#derive schema "../test-fixtures/data.csv" as Data  -- Resolves to test-fixtures/data.csv
#derive schema "data.csv" as Data                    -- Resolves to examples/data.csv
#derive schema "/absolute/path/data.csv" as Data     -- Uses absolute path
```

### Error Handling

If schema inference fails, the preprocessor inserts an error comment and preserves the original directive:

```stroum
-- ERROR: Unable to infer schema from "../nonexistent.csv": File not found
#derive schema "../nonexistent.csv" as Data
```

This allows you to see the error during parsing while keeping the directive visible for debugging.

## 3. Runtime Functions

Load and infer schemas dynamically at runtime:

### `infer_schema(path: String) -> Record`

Returns a schema record with field metadata:

```stroum
f:main => {
  infer_schema("data/users.csv")
  |> println
}

-- Output:
-- {
--   name: "User",
--   fields: [
--     { name: "id", type: "Int" },
--     { name: "name", type: "String" },
--     ...
--   ],
--   source: "data/users.csv"
-- }
```

### `read_csv(path: String) -> Stream<Record>`

Loads CSV data as a stream of records:

```stroum
f:main => {
  read_csv("data/customers.csv")
  |> map(row => println("Customer: #{row.name}"))
}
```

### `read_json(path: String) -> Stream<Record>`

Loads JSON array data as a stream of records:

```stroum
f:main => {
  read_json("api/users.json")
  |> filter(user => user.active)
  |> map(user => println(user.email))
}
```

## Supported File Formats

### CSV Files

- Header row defines field names
- Subsequent rows provide sample data for type inference
- All CSV parsing handled by `papaparse` library

**Example CSV:**

```csv
id,name,email,age,score,active
1,Alice,alice@example.com,30,95.5,true
2,Bob,bob@example.com,25,87.3,false
```

**Generated struct:**

```stroum
s:Row {
  id: Int
  name: String
  email: String
  age: Int
  score: Float
  active: Bool
}
```

### JSON Files

- Must be an array of objects
- First object's fields determine the schema
- Nested objects not supported (will be inferred as `String`)

**Example JSON:**

```json
[
  {
    "userId": 1,
    "username": "alice",
    "email": "alice@example.com",
    "isActive": true,
    "balance": 150.75
  },
  {
    "userId": 2,
    "username": "bob",
    "email": "bob@example.com",
    "isActive": false,
    "balance": 89.50
  }
]
```

**Generated struct:**

```stroum
s:User {
  userId: Int
  username: String
  email: String
  isActive: Bool
  balance: Float
}
```

## Choosing an Approach

| Approach | Use When |
|----------|----------|
| **CLI Tool** | You need to inspect the schema before using it, or include it in documentation |
| **Preprocessor** | The data structure is stable and known at compile time |
| **Runtime** | The data structure may vary or is unknown until runtime |

## Complete Example

**test-fixtures/sample.csv:**
```csv
id,name,email,age,score,active
1,Alice,alice@example.com,30,95.5,true
2,Bob,bob@example.com,25,87.3,false
3,Charlie,charlie@example.com,35,92.1,true
```

**examples/derive-demo.stm:**
```stroum
-- Compile-time schema injection
#derive schema "../test-fixtures/sample.csv" as Row

f:process_row row:Row => {
  println("Processing a row:")
  |> println(row)
}

f:main => {
  read_csv("test-fixtures/sample.csv")
  |> head
  |> process_row
}
```

**Running the program:**
```bash
$ stroum run examples/derive-demo.stm

=== Testing #derive Macro ===
Processing a row:
{
  id: 1,
  name: 'Alice',
  email: 'alice@example.com',
  age: 30,
  score: 95.5,
  active: true
}
```

## Implementation Details

### Architecture

```
schema-deriver.ts      -- Core inference engine
  ├── inferSchema()    -- Analyzes file and extracts types
  └── schemaToStroumSource() -- Generates struct syntax

preprocessor.ts        -- Compile-time directive expansion
  ├── hasDirectives()  -- Quick check for #derive
  └── preprocess()     -- Expands directives to structs

stdlib/formats.ts      -- Runtime functions
  ├── infer_schema()   -- Dynamic schema inspection
  ├── read_csv()       -- CSV data loading
  └── read_json()      -- JSON data loading
```

### Integration Points

1. **Module Resolver**: Calls preprocessor before lexer
2. **CLI**: Directly invokes `inferSchema()` and outputs result
3. **Runtime**: `formats.ts` stdlib functions wrap `inferSchema()`

### Testing

The feature includes comprehensive test coverage:

- `schema-deriver.test.ts` - 7 tests for core inference logic
- `preprocessor.test.ts` - 9 tests for directive expansion
- End-to-end integration tests with real CSV/JSON files

Run tests:
```bash
npm test -- schema-deriver
npm test -- preprocessor
```

## Limitations

1. **Type Inference**: Only basic types supported (Int, Float, String, Bool)
2. **Nested Structures**: Nested objects/arrays inferred as String
3. **Struct Names**: Must be "Capitalised" format (e.g., `Row`, not `CsvRow`)
4. **Sample Size**: Inference based on first few rows (may miss rare types)
5. **CSV Headers**: Required - first row must contain field names

## Future Enhancements

Potential improvements for future versions:

- Support for nested struct inference
- Union types for mixed-type fields
- Optional field detection (null/undefined handling)
- Custom type mappings configuration
- Support for XML, TOML, YAML formats
- Schema validation at runtime
- Generated documentation from inferred schemas
