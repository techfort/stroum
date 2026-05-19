---
name: Create Stroum Language Designer Skill
description: "Generate a VS Code chat skill that acts as a Stroum language programmer and feature designer"
argument-hint: "Skill focus (for example: type system, parser features, runtime semantics, LSP support)"
agent: "agent"
model: "GPT-5 (copilot)"
---
Create or update a workspace skill at:
- `.github/skills/stroum-language-designer/SKILL.md`

Use this repository as source of truth for Stroum details, especially:
- `CLAUDE.md`
- `README.md`
- `src/lexer.ts`, `src/parser.ts`, `src/validator.ts`, `src/transpiler.ts`
- `src/language-server.ts`, `src/lsp-completion.ts`
- `src/runtime-template.ts`

Goal:
Create a high-signal skill that helps an agent do both:
1. Stroum language programming tasks (implement/fix lexer, parser, validator, transpiler, runtime, stdlib, tests)
2. Stroum feature design tasks (syntax/semantics proposals, tradeoffs, migration path, staged rollout)

Use the user argument as the priority focus area. If no argument is provided, default to general language evolution and implementation.

Requirements for the generated `SKILL.md`:
1. Include YAML frontmatter with:
- `name: stroum-language-designer`
- `description:` containing strong trigger phrases such as:
  - Stroum syntax
  - language feature
  - parser/lexer/transpiler
  - runtime semantics
  - type system
  - stream operators
  - LSP/completions
2. Add clear sections:
- When to use
- Do not use for
- Inputs to request from the user
- Workflow
- Deliverables
- Guardrails
- Definition of done
3. Workflow must force concrete implementation behavior:
- Inspect existing grammar/AST/token impacts before coding
- Update parser + validator + transpiler together when semantics change
- Add or update tests in relevant `src/*.test.ts`
- Run focused tests first, then broader tests as needed
- Document breaking changes and migration notes
4. Deliverables must include both:
- Design artifacts (mini-spec, examples, compatibility notes)
- Code artifacts (edits + tests + command list run)
5. Make it concise, practical, and specific to this codebase. Avoid generic language-design advice.

Execution instructions:
- Actually create or edit the skill file in the workspace.
- If an existing skill is present, improve it in place instead of duplicating.
- Keep output ASCII.
- End with a short summary of what was created/updated.
