import { CompletionItemKind } from "vscode-languageserver/node";
import { Lexer } from "./lexer";
import {
  buildCompletions,
  collectSymbols,
  detectContext,
  getCompletions,
  getHover,
  getStdlibNames,
} from "./lsp-completion";
import { Parser } from "./parser";

function parse(source: string) {
  return new Parser(new Lexer(source).tokenize()).parse();
}

// ─── detectContext ────────────────────────────────────────────────────────────

describe("detectContext", () => {
  it("returns 'import' when line ends with i:", () => {
    expect(detectContext("i:")).toBe("import");
    expect(detectContext("  i:")).toBe("import");
  });

  it("returns 'pipe' when line ends with |>", () => {
    expect(detectContext("42 |>")).toBe("pipe");
    expect(detectContext("foo |> bar |>")).toBe("pipe");
    expect(detectContext("x |>  ")).toBe("pipe");
  });

  it("returns 'line-start' for empty or comment-only lines", () => {
    expect(detectContext("")).toBe("line-start");
    expect(detectContext("   ")).toBe("line-start");
    expect(detectContext("-- a comment")).toBe("line-start");
  });

  it("returns 'general' for mid-expression positions", () => {
    expect(detectContext("mul(")).toBe("general");
    expect(detectContext("f:foo x => ad")).toBe("general");
    expect(detectContext("i:core")).toBe("general");
  });
});

// ─── collectSymbols ───────────────────────────────────────────────────────────

describe("collectSymbols", () => {
  it("collects function declarations", () => {
    const module = parse("f:double n => mul(n, 2)");
    const syms = collectSymbols(module);
    expect(syms).toContainEqual({
      kind: "function",
      name: "double",
      detail: "f:double n",
    });
  });

  it("collects multi-param functions", () => {
    const module = parse("f:add a b => add(a, b)");
    const syms = collectSymbols(module);
    const fn = syms.find((s) => s.name === "add");
    expect(fn?.detail).toBe("f:add a b");
  });

  it("collects binding declarations", () => {
    const module = parse(":x 42");
    const syms = collectSymbols(module);
    expect(syms).toContainEqual({ kind: "binding", name: "x", detail: ":x" });
  });

  it("collects struct declarations", () => {
    const module = parse("s:User {\n  name: String\n}");
    const syms = collectSymbols(module);
    expect(syms).toContainEqual({
      kind: "struct",
      name: "User",
      detail: "s:User",
    });
  });

  it("collects multiple symbols from the same file", () => {
    const module = parse(
      "f:double n => mul(n, 2)\nf:triple n => mul(n, 3)\n:scale 10",
    );
    const syms = collectSymbols(module);
    expect(syms.map((s) => s.name)).toEqual(["double", "triple", "scale"]);
  });

  it("returns empty array for a file with no declarations", () => {
    const module = parse("42 |> println");
    expect(collectSymbols(module)).toEqual([]);
  });
});

// ─── buildCompletions ─────────────────────────────────────────────────────────

describe("buildCompletions", () => {
  it("returns only 'core' module for import context", () => {
    const items = buildCompletions("import", [], true);
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe("core");
    expect(items[0].kind).toBe(CompletionItemKind.Module);
  });

  it("includes stdlib functions in pipe context", () => {
    const items = buildCompletions("pipe", [], true);
    const labels = items.map((i) => i.label);
    expect(labels).toContain("mul");
    expect(labels).toContain("print");
    expect(labels).toContain("filter");
  });

  it("does not include keywords in pipe context", () => {
    const items = buildCompletions("pipe", [], true);
    const labels = items.map((i) => i.label);
    expect(labels).not.toContain("f:");
    expect(labels).not.toContain("on");
    expect(labels).not.toContain("route");
  });

  it("includes keyword snippets in line-start context", () => {
    const items = buildCompletions("line-start", [], false);
    const labels = items.map((i) => i.label);
    expect(labels).toContain("f:");
    expect(labels).toContain("i:core");
    expect(labels).toContain("on");
    expect(labels).toContain("route");
    expect(labels).toContain("wire:");
  });

  it("includes user symbols alongside stdlib in general context", () => {
    const userSymbols = [
      { kind: "function" as const, name: "myFn", detail: "f:myFn x" },
    ];
    const items = buildCompletions("general", userSymbols, true);
    const labels = items.map((i) => i.label);
    expect(labels).toContain("myFn");
    expect(labels).toContain("add");
  });

  it("omits stdlib when hasStdlib is false", () => {
    const items = buildCompletions("general", [], false);
    const labels = items.map((i) => i.label);
    expect(labels).not.toContain("mul");
    expect(labels).not.toContain("filter");
  });

  it("assigns correct CompletionItemKind for user symbols", () => {
    const syms = [
      { kind: "function" as const, name: "fn1", detail: "f:fn1" },
      { kind: "binding" as const, name: "b1", detail: ":b1" },
      { kind: "struct" as const, name: "S1", detail: "s:S1" },
    ];
    const items = buildCompletions("general", syms, false);
    const byLabel = Object.fromEntries(items.map((i) => [i.label, i.kind]));
    expect(byLabel.fn1).toBe(CompletionItemKind.Function);
    expect(byLabel.b1).toBe(CompletionItemKind.Variable);
    expect(byLabel.S1).toBe(CompletionItemKind.Class);
  });
});

// ─── getCompletions (integration) ────────────────────────────────────────────

describe("getCompletions", () => {
  it("returns stdlib items when cursor is after |>", () => {
    const module = parse("f:double n => mul(n, 2)");
    const items = getCompletions(module, "double(5) |>", true);
    expect(items.map((i) => i.label)).toContain("println");
  });

  it("returns user-defined function after |>", () => {
    const module = parse("f:double n => mul(n, 2)");
    const items = getCompletions(module, "5 |>", true);
    expect(items.map((i) => i.label)).toContain("double");
  });

  it("returns 'core' after i:", () => {
    const module = parse("");
    const items = getCompletions(module, "i:", true);
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe("core");
  });

  it("returns keyword snippets at line start", () => {
    const module = parse("");
    const items = getCompletions(module, "", true);
    const labels = items.map((i) => i.label);
    expect(labels).toContain("f:");
    expect(labels).toContain("on");
  });

  it("stdlib items have snippet insertText for multi-param functions", () => {
    const module = parse("");
    const items = getCompletions(module, "5 |>", true);
    const mulItem = items.find((i) => i.label === "mul");
    expect(mulItem?.insertText).toContain("${1:");
    expect(mulItem?.insertTextFormat).toBe(2);
  });

  it("single-param stdlib functions insert just the name (piped value fills param)", () => {
    const module = parse("");
    const items = getCompletions(module, "5 |>", true);
    const printItem = items.find((i) => i.label === "print");
    expect(printItem?.insertText).toBe("print");
  });
});

// ─── getHover ─────────────────────────────────────────────────────────────────

describe("getHover", () => {
  it("returns signature and doc for a stdlib function", () => {
    const module = parse("");
    const hover = getHover("mul", module);
    expect(hover).not.toBeNull();
    expect(hover?.signature).toBe("mul(a, b)");
    expect(hover?.doc).toBe("Multiply two numbers");
  });

  it("returns signature for a single-param stdlib function", () => {
    const hover = getHover("print", parse(""));
    expect(hover?.signature).toBe("print(x)");
  });

  it("returns user function signature", () => {
    const module = parse("f:double n => mul(n, 2)");
    const hover = getHover("double", module);
    expect(hover?.signature).toBe("f:double n");
    expect(hover?.doc).toBe("User-defined function");
  });

  it("returns user binding signature", () => {
    const module = parse(":count 0");
    const hover = getHover("count", module);
    expect(hover?.signature).toBe(":count");
    expect(hover?.doc).toBe("Binding");
  });

  it("returns struct signature with fields", () => {
    const module = parse("s:User {\n  name: String\n  age: Int\n}");
    const hover = getHover("User", module);
    expect(hover?.signature).toContain("s:User");
    expect(hover?.signature).toContain("name: String");
    expect(hover?.signature).toContain("age: Int");
    expect(hover?.doc).toBe("Struct");
  });

  it("returns null for unknown identifier", () => {
    expect(getHover("nonexistent", parse(""))).toBeNull();
  });

  it("prefers stdlib over a user function with the same name", () => {
    // If a user shadowed a stdlib name, stdlib takes priority in hover
    const module = parse("f:mul a b => add(a, b)");
    const hover = getHover("mul", module);
    expect(hover?.doc).toBe("Multiply two numbers");
  });
});

// ─── getStdlibNames ───────────────────────────────────────────────────────────

describe("getStdlibNames", () => {
  it("returns a non-empty array of strings", () => {
    const names = getStdlibNames();
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((n) => typeof n === "string")).toBe(true);
  });

  it("includes expected stdlib functions", () => {
    const names = getStdlibNames();
    for (const fn of ["add", "mul", "filter", "print", "to_string"]) {
      expect(names).toContain(fn);
    }
  });
});
