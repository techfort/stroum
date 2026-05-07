import { spawnSync } from "node:child_process";
import * as path from "node:path";
import {
  ensureSink,
  extractName,
  isDeclaration,
  needsContinuation,
} from "./repl";

// ─── isDeclaration ────────────────────────────────────────────────────────────

describe("isDeclaration", () => {
  it("recognises function sigil", () => {
    expect(isDeclaration("f:double n => mul(n, 2)")).toBe(true);
    expect(isDeclaration("f:greet name => println(name)")).toBe(true);
  });

  it("recognises struct sigil", () => {
    expect(isDeclaration("s:User { name: String }")).toBe(true);
  });

  it("recognises recursive function", () => {
    expect(isDeclaration("rec f:factorial n =>")).toBe(true);
  });

  it("recognises binding with explicit b: sigil", () => {
    expect(isDeclaration("b: :x 42")).toBe(true);
  });

  it("recognises binding with colon shorthand", () => {
    expect(isDeclaration(":x 42")).toBe(true);
    expect(isDeclaration(':name "Alice"')).toBe(true);
  });

  it("rejects plain expressions", () => {
    expect(isDeclaration("42 |> print")).toBe(false);
    expect(isDeclaration("add(1, 2)")).toBe(false);
    expect(isDeclaration("i:core")).toBe(false);
  });

  it("rejects meta-commands (no trailing space after colon-word)", () => {
    expect(isDeclaration(":quit")).toBe(false);
    expect(isDeclaration(":help")).toBe(false);
    expect(isDeclaration(":reset")).toBe(false);
  });
});

// ─── extractName ─────────────────────────────────────────────────────────────

describe("extractName", () => {
  it("extracts function name", () => {
    expect(extractName("f:double n => mul(n, 2)")).toBe("double");
  });

  it("extracts struct name", () => {
    expect(extractName("s:User { name: String }")).toBe("User");
  });

  it("extracts recursive function name", () => {
    expect(extractName("rec f:factorial n =>")).toBe("factorial");
  });

  it("extracts binding name from explicit sigil", () => {
    expect(extractName("b: :x 42")).toBe("x");
  });

  it("extracts binding name from colon shorthand", () => {
    expect(extractName(":count 0")).toBe("count");
    expect(extractName(':greeting "hi"')).toBe("greeting");
  });

  it("falls back to 'it' for unrecognised input", () => {
    expect(extractName("unknown stuff")).toBe("it");
  });
});

// ─── needsContinuation ───────────────────────────────────────────────────────

describe("needsContinuation", () => {
  it("continues on trailing =>", () => {
    expect(needsContinuation("f:foo x =>")).toBe(true);
    expect(needsContinuation("f:foo x =>   ")).toBe(true);
  });

  it("continues on trailing |>", () => {
    expect(needsContinuation("42 |>")).toBe(true);
  });

  it("continues on trailing comma", () => {
    expect(needsContinuation("add(1,")).toBe(true);
  });

  it("does not continue on complete lines", () => {
    expect(needsContinuation("f:double n => mul(n, 2)")).toBe(false);
    expect(needsContinuation("42 |> print")).toBe(false);
    expect(needsContinuation(":x 5")).toBe(false);
    expect(needsContinuation("")).toBe(false);
  });
});

// ─── ensureSink ──────────────────────────────────────────────────────────────

describe("ensureSink", () => {
  it("appends |> println when no sink is present", () => {
    expect(ensureSink("is_even(3)")).toBe("is_even(3) |> println");
    expect(ensureSink("mul(2, 3)")).toBe("mul(2, 3) |> println");
  });

  it("leaves expressions that already pipe to print unchanged", () => {
    expect(ensureSink("42 |> print")).toBe("42 |> print");
    expect(ensureSink("x |> println")).toBe("x |> println");
  });

  it("leaves expressions piping to other known sinks unchanged", () => {
    expect(ensureSink("x |> null_sink")).toBe("x |> null_sink");
    expect(ensureSink("x |> stdout")).toBe("x |> stdout");
    expect(ensureSink("x |> log_sink")).toBe("x |> log_sink");
  });

  it("handles sink mid-pipeline (does not double-append)", () => {
    expect(ensureSink("42 |> print |> null_sink")).toBe(
      "42 |> print |> null_sink",
    );
  });
});

// ─── REPL integration ────────────────────────────────────────────────────────

const cli = path.join(__dirname, "..", "dist", "cli.js");

function repl(input: string): string {
  const result = spawnSync("node", [cli, "repl"], {
    input,
    encoding: "utf-8",
    timeout: 20_000,
    env: { ...process.env, NO_COLOR: "1" },
  });
  // combine stdout + stderr so we see both output and error messages
  return (result.stdout ?? "") + (result.stderr ?? "");
}

describe("REPL session", () => {
  it("prints the welcome banner", () => {
    const out = repl(":quit\n");
    expect(out).toContain("Stroum");
    expect(out).toContain("REPL");
  });

  it("imports a module and confirms", () => {
    const out = repl("i:core\n:quit\n");
    expect(out).toContain("imported");
  });

  it("defines a function and confirms", () => {
    const out = repl("i:core\nf:double n => mul(n, 2)\n:quit\n");
    expect(out).toContain("defined double");
  });

  it("defines a binding and confirms", () => {
    const out = repl(":x 99\n:quit\n");
    expect(out).toContain("defined x");
  });

  it("evaluates an expression using session state", () => {
    const out = repl("i:core\nf:double n => mul(n, 2)\ndouble(21) |> print\n:quit\n");
    expect(out).toContain("42");
  });

  it("evaluates string interpolation", () => {
    const out = repl('i:core\n:who "world"\nprintln("Hello, #{who}!")\n:quit\n');
    expect(out).toContain("Hello, world!");
  });

  it(":session shows accumulated declarations", () => {
    const out = repl("f:double n => mul(n, 2)\n:session\n:quit\n");
    expect(out).toContain("f:double");
  });

  it(":reset clears the session", () => {
    const out = repl("f:double n => mul(n, 2)\n:reset\n:session\n:quit\n");
    expect(out).toContain("session cleared");
    expect(out).toContain("empty session");
  });

  it("deduplicates repeated imports", () => {
    const out = repl("i:core\ni:core\n:quit\n");
    expect(out).toContain("already imported");
  });

  it("reports a parse error without crashing", () => {
    const out = repl("i:core\n???\n:quit\n");
    expect(out).toContain("error");
    // REPL must still be alive after the error (session prompt returned)
    expect(out).toContain("Stroum");
  });
});
