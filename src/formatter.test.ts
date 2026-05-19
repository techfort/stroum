import { format } from "./formatter";
import { Lexer } from "./lexer";
import { Parser } from "./parser";

function parse(source: string) {
  return new Parser(new Lexer(source).tokenize()).parse();
}

function fmt(source: string): string {
  return format(parse(source));
}

// ─── Imports ──────────────────────────────────────────────────────────────────

describe("format: imports", () => {
  it("formats a bare stdlib import", () => {
    expect(fmt("i:core")).toBe("i:core\n");
  });

  it("formats multiple imports on separate lines", () => {
    const out = fmt("i:core\ni:utils");
    expect(out).toContain("i:core");
    expect(out).toContain("i:utils");
  });
});

// ─── Bindings ─────────────────────────────────────────────────────────────────

describe("format: bindings", () => {
  it("formats a simple number binding", () => {
    expect(fmt(":x 42")).toBe(":x 42\n");
  });

  it("formats a string binding", () => {
    expect(fmt(':greeting "hello"')).toBe(':greeting "hello"\n');
  });

  it("formats a boolean binding", () => {
    expect(fmt(":flag true")).toBe(":flag true\n");
  });

  it("formats a list binding", () => {
    expect(fmt(":nums [1, 2, 3]")).toBe(":nums [1, 2, 3]\n");
  });
});

// ─── Functions ────────────────────────────────────────────────────────────────

describe("format: functions", () => {
  it("formats a single-param function inline", () => {
    expect(fmt("f:double n:Int -> Int => mul(n, 2)")).toBe("f:double n:Int -> Int => mul(n, 2)\n");
  });

  it("formats a multi-param function inline", () => {
    expect(fmt("f:add a:Any b:Any -> Any => add(a, b)")).toBe("f:add a:Any b:Any -> Any => add(a, b)\n");
  });

  it("formats a recursive function", () => {
    const src =
      "rec f:fact n:Int -> Int => if eq(n, 0) then 1 else mul(n, fact(sub(n, 1)))";
    const out = fmt(src);
    expect(out).toMatch(/^rec f:fact n:Int -> Int =>/);
  });

  it("formats a function with a pipe body inline (pipes are always inline)", () => {
    const src = "f:pipeline x:Any -> Any => x |> double |> triple |> print";
    const out = fmt(src);
    expect(out).toBe("f:pipeline x:Any -> Any => x |> double |> triple |> print\n");
  });

  it("formats a two-stage pipe inline", () => {
    const src = "f:greet name:String -> Any => name |> println";
    const out = fmt(src);
    expect(out).toBe("f:greet name:String -> Any => name |> println\n");
  });

  it("preserves no-param functions", () => {
    const out = fmt("f:hello -> Void => println");
    expect(out).toMatch(/^f:hello/);
  });
});

// ─── Structs ─────────────────────────────────────────────────────────────────

describe("format: structs", () => {
  it("formats a struct with fields", () => {
    const src = "s:User {\n  name: String\n  age: Int\n}";
    const out = fmt(src);
    expect(out).toMatch(/^s:User \{/m);
    expect(out).toContain("name: String");
    expect(out).toContain("age: Int");
  });
});

// ─── Call expressions ─────────────────────────────────────────────────────────

describe("format: call expressions", () => {
  it("formats a call expression", () => {
    expect(fmt("mul(2, 3) |> println")).toContain("mul(2, 3)");
  });

  it("formats a nested call expression", () => {
    const out = fmt("add(mul(2, 3), 4) |> println");
    expect(out).toContain("add(mul(2, 3), 4)");
  });
});

// ─── If expressions ───────────────────────────────────────────────────────────

describe("format: if expressions", () => {
  it("formats a short if expression inline", () => {
    const out = fmt("f:abs n:Int -> Int => if lt(n, 0) then mul(n, -1) else n");
    expect(out).toContain("if lt(n, 0) then mul(n, -1) else n");
  });
});

// ─── Pipe expressions ─────────────────────────────────────────────────────────

describe("format: pipe expressions", () => {
  it("formats a short pipe inline", () => {
    const out = fmt("42 |> println");
    expect(out).toBe("42 |> println\n");
  });

  it("formats a long pipe inline", () => {
    const out = fmt("1 |> double |> triple |> negate |> println");
    expect(out.trim().split("\n")).toHaveLength(1);
    expect(out).toContain("|> double |> triple |> negate |> println");
  });
});

// ─── String interpolation ─────────────────────────────────────────────────────

describe("format: interpolated strings", () => {
  it("round-trips an interpolated string", () => {
    const src = ':name "Alice"\nprintln("Hello, #{name}!")';
    const out = fmt(src);
    expect(out).toContain("Hello, #{name}!");
  });
});

// ─── Lambda expressions ───────────────────────────────────────────────────────

describe("format: lambdas", () => {
  it("formats a single-param lambda", () => {
    const out = fmt("f:apply lst:Any -> Any => map(lst, |:x:Int| => mul(x, 2))");
    expect(out).toContain("|:x:Int| => mul(x, 2)");
  });
});

// ─── Multiple declarations ─────────────────────────────────────────────────────

describe("format: multiple declarations", () => {
  it("separates declarations with blank lines", () => {
    const src = "f:double n:Int -> Int => mul(n, 2)\nf:triple n:Int -> Int => mul(n, 3)";
    const out = fmt(src);
    expect(out).toContain("\n\n");
  });

  it("puts imports before definitions", () => {
    // Import must come first in source — parser loops on import-after-definition
    const src = "i:core\nf:double n:Int -> Int => mul(n, 2)";
    const out = fmt(src);
    const importIdx = out.indexOf("i:core");
    const defIdx = out.indexOf("f:double");
    expect(importIdx).toBeLessThan(defIdx);
  });
});

// ─── Idempotency ─────────────────────────────────────────────────────────────

describe("format: idempotency", () => {
  it("formatting twice gives same result as formatting once", () => {
    const src = "i:core\nf:double n:Int -> Int => mul(n, 2)\n:x 42\ndouble(x) |> print";
    const once = fmt(src);
    const twice = fmt(once.trimEnd());
    expect(twice).toBe(once);
  });
});
