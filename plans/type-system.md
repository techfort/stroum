# Type System Implementation Plan

## Syntax (Option B — Separate signature line)

```stroum
t:double Int -> Int
f:double n => mul(n, 2)

t:add Int -> Int -> Int
f:add a b => add(a, b)

t:Result[A] = .ok A | .err String
t:Callback = Int -> Bool

t:count Int
:count 42
```

Type declarations are optional and purely additive — untyped functions continue to work unchanged.

---

## Phase 1 — Lexer (`src/lexer.ts`)

One new token: `SIGIL_TYPE` for `t:`.

Everything else already exists:
- `->` is `OUTPUT_ARROW`
- `[` / `]` are `LBRACKET` / `RBRACKET`
- `|` is `PIPE`

---

## Phase 2 — AST (`src/ast.ts`)

### Type expression nodes

```typescript
// Primitive or type variable: Int, String, Bool, Float, A, T
TypeName     { name: string }

// Function type (right-associative): Int -> Int -> Bool
FunctionType { from: TypeExpr; to: TypeExpr }

// Generic application: List[A], Maybe[A, B]
GenericType  { name: string; params: TypeExpr[] }

// Sum type (inside t:Alias = ...): .ok A | .err String
SumType      { variants: { tag: string; payload: TypeExpr | null }[] }

export type TypeExpr = TypeName | FunctionType | GenericType | SumType;
```

### Declaration nodes

```typescript
// t:double Int -> Int  OR  t:count Int
TypeSignature { name: string; typeExpr: TypeExpr }

// t:Result[A] = .ok A | .err String
TypeAlias     { name: string; params: string[]; typeExpr: TypeExpr }
```

### Module

Add `typeDeclarations: (TypeSignature | TypeAlias)[]` to the `Module` interface.

---

## Phase 3 — Parser (`src/parser.ts`)

- `isTypeDeclaration()` — checks for `SIGIL_TYPE` at current position
- `parseTypeDeclaration()` — dispatches to signature vs alias (alias detected by `=` after name/params)
- `parseTypeExpr()` — recursive descent:
  - `->` right-associative, lowest precedence → `FunctionType`
  - `Name[...]` → `GenericType`
  - `.tag Payload | ...` → `SumType` (only inside alias RHS)
  - bare name → `TypeName` or type variable
- Wire into `parseModule()` in the definitions phase alongside `f:`, `s:`, `:`

---

## Phase 4 — Type Checker (`src/type-checker.ts`, new file)

New `TypeChecker` class producing `ValidationIssue[]`. Two responsibilities:

**Arity check**
For every `t:name T1 -> T2 -> ... -> Tn`, count the arrows (arity = n - 1).
The matching `f:name` must declare exactly that many parameters. Mismatch → error.

**Orphan check**
- `t:name` with no matching `f:` or `:` → warning
- `f:` or `:` whose `t:` annotation fails to parse → error

No full inference in this phase. Actual type correctness is delegated to TypeScript by emitting typed TS output (Phase 5).

---

## Phase 5 — Transpiler (`src/transpiler.ts`)

### Type mapping

| Stroum        | TypeScript                                      |
|---------------|-------------------------------------------------|
| `Int`         | `number`                                        |
| `Float`       | `number`                                        |
| `String`      | `string`                                        |
| `Bool`        | `boolean`                                       |
| `A` (type var)| `A` (TS generic)                                |
| `Int -> Int`  | `(x: number) => number`                         |
| `t:Result[A] = .ok A \| .err String` | `type Result<A> = { outcome: 'ok', value: A } \| { outcome: 'err', value: string }` |

### Typed function output

When a function has a matching `t:` signature, emit parameter and return types:

```typescript
// Before (untyped)
const double = async (n: any): Promise<any> => { ... }

// After (typed)
const double = async (n: number): Promise<number> => { ... }
```

Type aliases emit as TypeScript `type` declarations at the top of the output file.

---

## Phase 6 — Integration

- **`src/cli.ts`** — wire `TypeChecker` into compile/run pipeline alongside `Validator`
- **`src/lsp-server.ts`** — include type declaration names in completions; surface type errors as LSP diagnostics
- **`src/repl.ts`** — `isDeclaration` recognises `t:`; `extractName` returns the declared name; type sigs stored in session

---

## Phase 7 — Tests

- Lexer: `t:` token
- Parser: type sig, type alias, generic params, sum types, function types
- Type checker: arity mismatch errors, orphan sig warnings
- Transpiler: typed function output, type alias TS output
- End-to-end: compile a file with type annotations and verify generated TS

---

## Out of scope (this phase)

- Type inference (unannotated functions remain `any`)
- Row polymorphism / structural typing for structs
- Recursive types (`t:Tree[A] = .leaf | .node { left: Tree[A], right: Tree[A] }`)
- Module-level type exports
