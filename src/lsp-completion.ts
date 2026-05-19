import {
  type CompletionItem,
  CompletionItemKind,
} from "vscode-languageserver/node";
import type * as AST from "./ast";

// ─── Stdlib catalogue ────────────────────────────────────────────────────────

interface StdlibEntry {
  name: string;
  params: string[];
  doc: string;
}

const STDLIB: StdlibEntry[] = [
  // Arithmetic
  { name: "add", params: ["a", "b"], doc: "Add two numbers" },
  { name: "sub", params: ["a", "b"], doc: "Subtract b from a" },
  { name: "mul", params: ["a", "b"], doc: "Multiply two numbers" },
  { name: "div", params: ["a", "b"], doc: "Divide a by b" },
  { name: "mod", params: ["a", "b"], doc: "Remainder of a / b" },
  { name: "pow", params: ["base", "exp"], doc: "Raise base to exp" },
  { name: "abs", params: ["n"], doc: "Absolute value" },
  { name: "min", params: ["a", "b"], doc: "Minimum of two values" },
  { name: "max", params: ["a", "b"], doc: "Maximum of two values" },
  // Comparison
  { name: "eq", params: ["a", "b"], doc: "Equal" },
  { name: "neq", params: ["a", "b"], doc: "Not equal" },
  { name: "gt", params: ["a", "b"], doc: "Greater than" },
  { name: "gte", params: ["a", "b"], doc: "Greater than or equal" },
  { name: "lt", params: ["a", "b"], doc: "Less than" },
  { name: "lte", params: ["a", "b"], doc: "Less than or equal" },
  // Logic
  { name: "and", params: ["a", "b"], doc: "Logical and" },
  { name: "or", params: ["a", "b"], doc: "Logical or" },
  { name: "not", params: ["x"], doc: "Logical not" },
  // String
  { name: "concat", params: ["a", "b"], doc: "Concatenate two strings" },
  { name: "length", params: ["s"], doc: "Length of a string or list" },
  { name: "upper", params: ["s"], doc: "Uppercase string" },
  { name: "lower", params: ["s"], doc: "Lowercase string" },
  { name: "trim", params: ["s"], doc: "Trim whitespace" },
  { name: "split", params: ["s", "sep"], doc: "Split string by separator" },
  { name: "join", params: ["list", "sep"], doc: "Join list into string" },
  { name: "starts_with", params: ["s", "prefix"], doc: "Test string prefix" },
  { name: "ends_with", params: ["s", "suffix"], doc: "Test string suffix" },
  { name: "contains", params: ["s", "sub"], doc: "Test substring presence" },
  // List
  { name: "map", params: ["list", "fn"], doc: "Transform each element" },
  { name: "filter", params: ["list", "pred"], doc: "Keep matching elements" },
  { name: "reduce", params: ["list", "fn", "init"], doc: "Fold a list" },
  { name: "head", params: ["list"], doc: "First element" },
  { name: "tail", params: ["list"], doc: "All elements except the first" },
  { name: "take", params: ["list", "n"], doc: "First n elements" },
  { name: "drop", params: ["list", "n"], doc: "Skip first n elements" },
  { name: "reverse", params: ["list"], doc: "Reverse a list" },
  { name: "sort", params: ["list"], doc: "Sort a list" },
  { name: "is_empty", params: ["list"], doc: "True if list is empty" },
  // I/O
  { name: "print", params: ["x"], doc: "Print value to stdout" },
  { name: "println", params: ["x"], doc: "Print value with newline" },
  { name: "stdout", params: ["x"], doc: "Alias for println" },
  { name: "null_sink", params: ["x"], doc: "Discard value (consume stream)" },
  { name: "log_sink", params: ["x"], doc: "Log value and pass through" },
  {
    name: "debug",
    params: ["x", "label"],
    doc: "Print label + value, pass through",
  },
  { name: "trace", params: ["x"], doc: "Trace value through pipeline" },
  // Type conversion
  { name: "to_string", params: ["x"], doc: "Convert to string" },
  { name: "to_int", params: ["x"], doc: "Convert to integer" },
  { name: "to_float", params: ["x"], doc: "Convert to float" },
  // Error handling
  { name: "error", params: ["msg"], doc: "Raise an error" },
  { name: "try_catch", params: ["fn", "handler"], doc: "Catch errors from fn" },
  // Data
  {
    name: "infer_schema",
    params: ["data"],
    doc: "Infer struct schema from data",
  },
  { name: "read_csv", params: ["path"], doc: "Read CSV file as stream" },
  { name: "read_json", params: ["path"], doc: "Read JSON file" },
  // Assertions
  { name: "assert", params: ["cond"], doc: "Assert condition is true" },
  { name: "assert_eq", params: ["a", "b"], doc: "Assert a equals b" },
  { name: "assert_neq", params: ["a", "b"], doc: "Assert a does not equal b" },
  {
    name: "assert_contains",
    params: ["s", "sub"],
    doc: "Assert string contains substring",
  },
  { name: "assert_raises", params: ["fn"], doc: "Assert fn throws an error" },
];

// ─── Top-level keyword snippets ───────────────────────────────────────────────

const KEYWORDS: Array<{ label: string; insert: string; doc: string }> = [
  {
    label: "f:",
    insert: "f:" + "$" + "{1:name} " + "$" + "{2:param} => $0",
    doc: "Define a function",
  },
  {
    label: "rec f:",
    insert: "rec f:" + "$" + "{1:name} " + "$" + "{2:param} =>\n  $0",
    doc: "Define a recursive function",
  },
  {
    label: "i:",
    insert: 'i:"' + "$" + "{1:module}" + '"',
    doc: "Import a module",
  },
  { label: "i:core", insert: "i:core", doc: "Import the standard library" },
  {
    label: "s:",
    insert:
      "s:" +
      "$" +
      "{1:Name} {\n  " +
      "$" +
      "{2:field}: " +
      "$" +
      "{3:Type}\n}",
    doc: "Define a struct",
  },
  {
    label: "on",
    insert:
      "on @" + "$" + "{1:stream} |> |:" + "$" + "{2:x}| => $0",
    doc: "Stream event handler",
  },
  {
    label: "route",
    insert: "route @" + "$" + "{1:stream} |> $0",
    doc: "Route a stream through a pipeline",
  },
  {
    label: "wire:",
    insert: "wire: @" + "$" + "{1:from} -> @" + "$" + "{2:to}",
    doc: "Wire two pipeline streams",
  },
  {
    label: "input:",
    insert: "input:  @" + "$" + "{1:stream}",
    doc: "Declare a module input stream",
  },
  {
    label: "output:",
    insert: "output: @" + "$" + "{1:stream}",
    doc: "Declare a module output stream",
  },
  {
    label: "src:",
    insert: "src: @" + "$" + "{1:stream} " + "$" + "{2:value}",
    doc: "Inject a value into a stream",
  },
  {
    label: "to:",
    insert: "to: @" + "$" + "{1:stream} " + "$" + "{2:sink}",
    doc: "Drain a stream to a sink",
  },
];

// ─── Context detection ────────────────────────────────────────────────────────

export type CompletionContext =
  | "import" // cursor is after i: — suggest module names
  | "pipe" // cursor follows |> — functions only
  | "line-start" // blank / start of line — keywords + everything
  | "general"; // anywhere else — functions + bindings + structs

export function detectContext(linePrefix: string): CompletionContext {
  const trimmed = linePrefix.trimStart();
  if (/i:$/.test(linePrefix)) return "import";
  if (/\|>\s*$/.test(linePrefix)) return "pipe";
  if (trimmed === "" || /^--/.test(trimmed)) return "line-start";
  return "general";
}

// ─── Name collector ───────────────────────────────────────────────────────────

export interface UserSymbol {
  kind: "function" | "binding" | "struct";
  name: string;
  detail: string;
}

export function collectSymbols(module: AST.Module): UserSymbol[] {
  const symbols: UserSymbol[] = [];
  for (const def of module.definitions) {
    if (def.type === "FunctionDeclaration") {
      const sig =
        def.params.length > 0
          ? `f:${def.name} ${def.params.join(" ")}`
          : `f:${def.name}`;
      symbols.push({ kind: "function", name: def.name, detail: sig });
    } else if (def.type === "BindingDeclaration") {
      symbols.push({ kind: "binding", name: def.name, detail: `:${def.name}` });
    } else if (def.type === "StructDeclaration") {
      symbols.push({ kind: "struct", name: def.name, detail: `s:${def.name}` });
    }
  }
  return symbols;
}

// ─── Completion builder ───────────────────────────────────────────────────────

function stdlibItem(entry: StdlibEntry): CompletionItem {
  const sig = `${entry.name}(${entry.params.join(", ")})`;
  return {
    label: entry.name,
    kind: CompletionItemKind.Function,
    detail: sig,
    documentation: entry.doc,
    // Snippet inserts function call with tab stops
    insertText:
      entry.params.length === 1
        ? entry.name
        : `${entry.name}(${entry.params.map((p, i) => `\${${i + 1}:${p}}`).join(", ")})`,
    insertTextFormat: 2, // Snippet
  };
}

function userItem(sym: UserSymbol): CompletionItem {
  return {
    label: sym.name,
    kind:
      sym.kind === "function"
        ? CompletionItemKind.Function
        : sym.kind === "binding"
          ? CompletionItemKind.Variable
          : CompletionItemKind.Class,
    detail: sym.detail,
  };
}

function keywordItem(kw: (typeof KEYWORDS)[number]): CompletionItem {
  return {
    label: kw.label,
    kind: CompletionItemKind.Keyword,
    detail: kw.doc,
    insertText: kw.insert,
    insertTextFormat: 2, // Snippet
  };
}

export function buildCompletions(
  context: CompletionContext,
  userSymbols: UserSymbol[],
  includeStdlib: boolean,
): CompletionItem[] {
  const items: CompletionItem[] = [];

  if (context === "import") {
    return [
      {
        label: "core",
        kind: CompletionItemKind.Module,
        detail: "Stroum standard library",
      },
    ];
  }

  if (context === "line-start") {
    items.push(...KEYWORDS.map(keywordItem));
  }

  if (includeStdlib) items.push(...STDLIB.map(stdlibItem));
  items.push(...userSymbols.map(userItem));

  return items;
}

// ─── Hover ────────────────────────────────────────────────────────────────────

export interface HoverContent {
  signature: string;
  doc: string;
}

export function getHover(
  word: string,
  module: AST.Module,
): HoverContent | null {
  // Check stdlib first
  const stdlib = STDLIB.find((e) => e.name === word);
  if (stdlib) {
    const sig = `${stdlib.name}(${stdlib.params.join(", ")})`;
    return { signature: sig, doc: stdlib.doc };
  }

  // Check user-defined symbols
  for (const def of module.definitions) {
    if (def.type === "FunctionDeclaration" && def.name === word) {
      const sig =
        def.params.length > 0
          ? `f:${def.name} ${def.params.join(" ")}`
          : `f:${def.name}`;
      return { signature: sig, doc: "User-defined function" };
    }
    if (def.type === "BindingDeclaration" && def.name === word) {
      return { signature: `:${def.name}`, doc: "Binding" };
    }
    if (def.type === "StructDeclaration" && def.name === word) {
      const fields = def.fields
        .map((f) => `  ${f.name}: ${f.typeName}`)
        .join("\n");
      return { signature: `s:${def.name} {\n${fields}\n}`, doc: "Struct" };
    }
  }

  return null;
}

// ─── REPL tab-completion names ────────────────────────────────────────────────

export function getStdlibNames(): string[] {
  return STDLIB.map((e) => e.name);
}

// ─── Public entry point ───────────────────────────────────────────────────────

export function getCompletions(
  module: AST.Module,
  linePrefix: string,
  hasStdlib: boolean,
): CompletionItem[] {
  const context = detectContext(linePrefix);
  const symbols = collectSymbols(module);
  return buildCompletions(context, symbols, hasStdlib);
}
