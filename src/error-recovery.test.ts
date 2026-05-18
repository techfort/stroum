import { Lexer } from "./lexer";
import { Parser } from "./parser";

// ─── Lexer error recovery ────────────────────────────────────────────────────

describe("Lexer error recovery", () => {
  it("records an error for an unexpected character instead of throwing", () => {
    const lexer = new Lexer(":x 42 $ :y 1");
    const tokens = lexer.tokenize();
    expect(lexer.diagnostics).toHaveLength(1);
    expect(lexer.diagnostics[0].stage).toBe("lex");
    expect(lexer.diagnostics[0].severity).toBe("error");
    expect(lexer.diagnostics[0].message).toMatch(/Unexpected character/);
  });

  it("continues tokenising valid tokens after a lex error", () => {
    const lexer = new Lexer(":x 42 $ :y 1");
    const tokens = lexer.tokenize();
    // Tokens for :x 42 and :y 1 should still be present despite the $
    const values = tokens.map((t) => t.value);
    expect(values).toContain("42");
    expect(values).toContain("1");
  });

  it("records multiple lex errors in one pass", () => {
    const lexer = new Lexer("$ % ^");
    lexer.tokenize();
    expect(lexer.diagnostics.length).toBeGreaterThanOrEqual(3);
  });

  it("records error for unterminated string", () => {
    const lexer = new Lexer(':x "unterminated');
    lexer.tokenize();
    expect(lexer.diagnostics).toHaveLength(1);
    expect(lexer.diagnostics[0].message).toMatch(/Unterminated string/);
  });
});

// ─── Parser error recovery ───────────────────────────────────────────────────

describe("Parser error recovery", () => {
  function parse(source: string) {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const module = parser.parse();
    return { module, diagnostics: parser.diagnostics };
  }

  it("records a parse error instead of throwing", () => {
    // Missing name after f:
    const { diagnostics } = parse("f: => 42");
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics[0].stage).toBe("parse");
    expect(diagnostics[0].severity).toBe("error");
  });

  it("recovers and parses a valid function after a broken one", () => {
    const source = [
      "f: => 42",           // broken: missing name
      "f:good x:Int -> Int => add(x, 1)", // valid
    ].join("\n");
    const { module, diagnostics } = parse(source);
    expect(diagnostics.length).toBeGreaterThan(0);
    // The valid function should still be in the AST
    const names = module.definitions
      .filter((d) => d.type === "FunctionDeclaration")
      .map((d) => (d as { name: string }).name);
    expect(names).toContain("good");
  });

  it("collects errors from multiple broken definitions in one pass", () => {
    const source = [
      "f: => 1",   // broken
      "f: => 2",   // broken
      "f: => 3",   // broken
    ].join("\n");
    const { diagnostics } = parse(source);
    expect(diagnostics.length).toBeGreaterThanOrEqual(2);
  });

  it("reports structured location (line, column) on parse errors", () => {
    const { diagnostics } = parse("f: => 42");
    expect(diagnostics[0].line).toBeGreaterThanOrEqual(1);
    expect(diagnostics[0].column).toBeGreaterThanOrEqual(1);
  });

  it("returns a valid (possibly partial) module even with parse errors", () => {
    const { module } = parse("f: => broken_syntax !!!");
    expect(module).toBeDefined();
    expect(module.type).toBe("Module");
  });
});
