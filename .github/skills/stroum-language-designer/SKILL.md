---
name: stroum-language-designer
description: Use for Stroum syntax and language feature work, parser/lexer/transpiler changes, runtime semantics updates, type system evolution, stream operators design, and LSP/completions behavior.
---

# Stroum Language Designer

Build and evolve the Stroum language across design and implementation.

Default focus when no user argument is provided: general language evolution and implementation.

## When to use

- Implement or fix Stroum compiler pipeline behavior in src/lexer.ts, src/parser.ts, src/validator.ts, src/transpiler.ts, and related AST/token files.
- Add or revise language constructs (sigils, operators, declarations, expressions, stream behavior, tests, imports).
- Change runtime stream semantics in src/runtime-template.ts (emit ordering, handler behavior, stream metadata, run-until behavior).
- Update IDE behavior in src/language-server.ts and src/lsp-completion.ts when syntax/semantics change.
- Design a new language feature with concrete syntax, semantics, compatibility, and rollout path.

## Do not use for

- Generic TypeScript app work unrelated to Stroum language/compiler/runtime/LSP.
- Pure UI/webview styling tasks that do not affect language behavior.
- DevOps or release automation changes unless explicitly tied to language delivery.

## Inputs to request from the user

- Priority focus area for this run (feature/design/fix). Use this as the top priority.
- Desired syntax examples in .stm form, including at least one positive and one invalid case.
- Expected semantics and edge cases (error behavior, precedence, arity, stream ordering, runtime effects).
- Compatibility expectations (breaking or non-breaking) and migration constraints.
- Scope boundaries (compiler only, runtime included, LSP included, docs/tests required).

## Workflow

1. Establish scope and baseline
- Confirm the user argument as priority focus.
- Identify impacted stages in the pipeline: preprocessor -> lexer -> parser -> validator -> transpiler -> runtime/LSP.
- Locate current behavior in src/ast.ts and src/types.ts before editing syntax or semantics.

2. Inspect impact before coding
- Determine token changes in src/types.ts and lexing rules in src/lexer.ts.
- Determine AST shape and parse entry points in src/parser.ts.
- Determine semantic rules and diagnostics in src/validator.ts.
- Determine codegen/runtime implications in src/transpiler.ts and src/runtime-template.ts.
- Determine editor impact in src/language-server.ts and src/lsp-completion.ts.

3. Implement coherently
- When semantics change, update parser + validator + transpiler together in one coherent pass.
- Update lexer/token/AST definitions if syntax changes require it.
- Keep runtime semantics aligned with transpiler output (especially stream emit/route behavior and async ordering).
- Update LSP completions/hover/diagnostics/go-to-definition behavior if user-facing syntax or symbols changed.

4. Test in focused-to-broad order
- Add or update targeted tests first in relevant files, such as:
  - src/lexer.test.ts or src/lexer-integration.test.ts
  - src/parser.test.ts or src/error-recovery.test.ts
  - src/validator.test.ts
  - src/transpiler.test.ts
  - src/lsp-completion.test.ts
  - src/ingest.test.ts, src/cli.test.ts, src/dataflow-analyzer.test.ts when feature overlap exists
- Run focused tests first (for changed subsystem), then broader regression tests as needed.

5. Document compatibility and rollout
- Explicitly call out breaking vs non-breaking behavior.
- Provide migration notes for old syntax/semantics, including examples.
- If risky, suggest staged rollout (parse-only, behind flag, warning period, full enforcement).

## Deliverables

Design artifacts:
- Mini-spec: syntax, grammar shape, AST impact, validation rules, transpilation/runtime semantics.
- Example set: valid programs, invalid programs, and expected diagnostics.
- Compatibility notes: breaking changes, migration path, fallback behavior.

Code artifacts:
- Concrete edits in impacted source files.
- Updated or new tests in relevant src/*.test.ts files.
- Command list executed (focused tests first, then wider tests if needed) and outcomes.

## Guardrails

- Do not propose syntax without mapping it to lexer tokens, parser production, AST representation, validator rules, and transpiler output.
- Do not change runtime semantics without verifying transpiler alignment and stream-ordering implications.
- Preserve existing language style: pipe-first semantics, stream-first routing, indentation-sensitive structure, and diagnostic quality.
- Avoid broad refactors unrelated to the requested feature/fix.
- Prefer minimal, reversible deltas for risky changes.

## Definition of done

- User priority focus area is addressed end-to-end.
- Grammar/token/AST/validator/transpiler/runtime/LSP impacts are either implemented or explicitly marked out-of-scope with rationale.
- Relevant tests are updated/added and run in focused-to-broad order.
- Breaking changes and migration notes are documented.
- Final output includes both design and code deliverables with command results.
