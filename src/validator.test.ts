import { Lexer } from "./lexer";
import { Parser } from "./parser";
import { Validator } from "./validator";

function validate(source: string) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const validator = new Validator();
  return validator.validate(ast);
}

function parseDiagnostics(source: string) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  parser.parse();
  return parser.diagnostics;
}

describe("Validator", () => {
  describe("duplicate bindings", () => {
    it("should error on duplicate function names", () => {
      const issues = validate("f:foo -> Int => 1\nf:foo -> Int => 2");
      const errors = issues.filter((i) => i.type === "error");
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain("Duplicate binding");
    });

    it("should error on duplicate binding names", () => {
      const issues = validate(":x 10\n:x 20");
      const errors = issues.filter((i) => i.type === "error");
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain("Duplicate binding");
    });

    it("should error on duplicate function parameters", () => {
      const issues = validate("f:foo x:Int x:Int -> Int => add(x, x)");
      const errors = issues.filter((i) => i.type === "error");
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain("Duplicate parameter");
    });

    it("should error on duplicate struct fields", () => {
      const source = `s:User {
  name: String
  name: String
}`;
      const issues = validate(source);
      const errors = issues.filter((i) => i.type === "error");
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain("Duplicate field");
    });

    it("should allow same name in different scopes", () => {
      const issues = validate("f:foo x:Any -> Any => |:x:Any| => x");
      const errors = issues.filter((i) => i.type === "error");
      expect(errors.length).toBe(0);
    });
  });

  describe("rec validation", () => {
    it("should warn when rec is used without self-reference", () => {
      const issues = validate("rec f:foo n:Int -> Int => add(n, 1)");
      const warnings = issues.filter((i) => i.type === "warning");
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].message).toContain("does not reference itself");
    });

    it("should not warn when rec is used with self-reference", () => {
      const issues = validate("rec f:factorial n:Int -> Int => multiply(n, factorial(n))");
      const warnings = issues.filter(
        (i) =>
          i.type === "warning" &&
          i.message.includes("does not reference itself"),
      );
      expect(warnings.length).toBe(0);
    });

    it("should detect self-reference in pipe chains", () => {
      const issues = validate(
        "rec f:process data:Any -> Any => data |> transform |> process",
      );
      const warnings = issues.filter(
        (i) =>
          i.type === "warning" &&
          i.message.includes("does not reference itself"),
      );
      expect(warnings.length).toBe(0);
    });
  });

  describe("emission contract validation", () => {
    it("should warn when multiple outcomes without contract", () => {
      const source = `f:fetch url:String -> Any =>
  http_get(url) @ok
  | .error => @fail`;
      const issues = validate(source);
      const warnings = issues.filter((i) => i.type === "warning");
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].message).toContain("outcome paths");
      expect(warnings[0].message).toContain("no emission contract");
    });

    it("should not warn when emission contract is declared", () => {
      const source = `f:fetch url:String -> Any ~> @ok, @fail =>
  http_get(url) @ok
  | .error => @fail`;
      const issues = validate(source);
      const warnings = issues.filter(
        (i) => i.type === "warning" && i.message.includes("outcome paths"),
      );
      expect(warnings.length).toBe(0);
    });

    it("should not warn for single outcome", () => {
      const issues = validate('f:double n:Int -> Int => multiply(n, 2) @result');
      const warnings = issues.filter(
        (i) => i.type === "warning" && i.message.includes("outcome paths"),
      );
      expect(warnings.length).toBe(0);
    });
  });

  describe("stream declaration validation", () => {
    it("should reject invalid stream names in contract at parse stage", () => {
      const diagnostics = parseDiagnostics(
        "f:foo -> Any ~> @123invalid, @ok => result @ok",
      );
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain("Expected stream identifier");
    });

    it("should accept valid stream names", () => {
      const issues = validate('f:foo -> Any ~> @ok, @error => result @ok');
      const errors = issues.filter(
        (i) => i.type === "error" && i.message.includes("string literal"),
      );
      expect(errors.length).toBe(0);
    });

    it("should warn for open-ended src declarations without run until", () => {
      const issues = validate('src: @changes watch_file("watched.txt")');
      const warnings = issues.filter((i) => i.type === "warning");
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].message).toContain("open-ended src: sources");
      expect(warnings[0].message).toContain("run until");
    });

    it("should not warn for open-ended src declarations with run until", () => {
      const issues = validate(
        'src: @changes watch_file("watched.txt")\nrun until signal',
      );
      const warnings = issues.filter(
        (i) =>
          i.type === "warning" && i.message.includes("open-ended src: sources"),
      );
      expect(warnings.length).toBe(0);
    });

    it("should not warn for finite src declarations without run until", () => {
      const issues = validate('src: @orders file("orders.csv")');
      const warnings = issues.filter(
        (i) =>
          i.type === "warning" && i.message.includes("open-ended src: sources"),
      );
      expect(warnings.length).toBe(0);
    });

    it("should not warn for from_list src without run until", () => {
      const issues = validate('src: @items from_list([1, 2, 3])');
      const warnings = issues.filter(
        (i) =>
          i.type === "warning" && i.message.includes("open-ended src: sources"),
      );
      expect(warnings.length).toBe(0);
    });

    it("should warn for interval src without run until", () => {
      const issues = validate('i:timer\nsrc: @tick interval(1000)');
      const warnings = issues.filter(
        (i) => i.type === "warning" && i.message.includes("open-ended src: sources"),
      );
      expect(warnings.length).toBeGreaterThan(0);
    });

    it("should warn for stdin_lines src without run until", () => {
      const issues = validate('i:io\nsrc: @lines stdin_lines()');
      const warnings = issues.filter(
        (i) => i.type === "warning" && i.message.includes("open-ended src: sources"),
      );
      expect(warnings.length).toBeGreaterThan(0);
    });

    it("should validate to declarations without introducing liveness warnings", () => {
      const issues = validate(
        "f:persist_order order:Any -> Any => order\nsnk: @orders_clean persist_order",
      );
      const errors = issues.filter((i) => i.type === "error");
      const warnings = issues.filter(
        (i) =>
          i.type === "warning" && i.message.includes("open-ended src: sources"),
      );
      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(0);
    });
  });

  describe("complex validation", () => {
    it("should validate field access receiver names in expressions", () => {
      const issues = validate("f:is_adult user:Any -> Bool => gt(user.age, 18)");
      const errors = issues.filter((i) => i.type === "error");
      expect(errors.length).toBe(0);
    });

    it("should allow a function body binding to be referenced by later statements", () => {
      const source = `f:check_positive x:Any -> Any =>
  if gt(x, 0) then
    x @positive
  else
    x @non_positive

f:main -> Void =>
  :nums [1, -2, 3, 0]
  map(check_positive, nums)`;

      const issues = validate(source);
      const errors = issues.filter((i) => i.type === "error");
      expect(errors.length).toBe(0);
    });

    it("should validate complete program with no errors", () => {
      const source = `-- Define helper functions used in this test
f:json_parse raw:Any -> Any => raw
f:normalise data:Any -> Any => data
f:validate data:Any -> Any => data
f:merge a:Any -> Any => a
f:fetch url:String -> Any => url
f:log msg:Any -> Void => msg

-- Define bindings used in expressions
:primary "url1"
:secondary "url2"

f:parse raw:Any -> Any ~> @ok, @fail =>
  json_parse(raw) @ok
  | .fail => @fail

f:transform data:Any -> Any ~> @clean, @rejected =>
  data |> normalise |> validate @clean
  | .invalid => @rejected

fetch(primary) PP fetch(secondary) |> merge @data

on @errors |> |:e:Any| => log(e)`;

      const issues = validate(source);
      const errors = issues.filter((i) => i.type === "error");
      expect(errors.length).toBe(0);
    });

    it("should catch multiple issues in one program", () => {
      const source = `f:foo -> Int => 1
f:foo -> Int => 2
rec f:bar x:Int -> Int => add(x, 1)
f:baz y:Any -> Any =>
  result @ok
  | .error => @fail`;

      const issues = validate(source);
      const errors = issues.filter((i) => i.type === "error");
      const warnings = issues.filter((i) => i.type === "warning");

      expect(errors.length).toBeGreaterThan(0); // Duplicate function
      expect(warnings.length).toBeGreaterThan(0); // rec without self-ref, multiple outcomes
    });
  });

  describe("scope handling", () => {
    it("should track function parameter scope", () => {
      const issues = validate("f:apply fn:Fn x:Any -> Any => fn(x)");
      const errors = issues.filter((i) => i.type === "error");
      expect(errors.length).toBe(0);
    });

    it("should track lambda parameter scope", () => {
      const issues = validate(":nums [1, 2, 3]\nmap(nums, |:n:Int| => add(n, 1))");
      const errors = issues.filter((i) => i.type === "error");
      expect(errors.length).toBe(0);
    });

    it("should handle nested lambdas", () => {
      const issues = validate("f:curry fn:Fn -> Any => |:x:Any| => |:y:Any| => fn(x, y)");
      const errors = issues.filter((i) => i.type === "error");
      expect(errors.length).toBe(0);
    });
  });

  describe("arity checking", () => {
    it("should error when too few arguments are passed to a user function", () => {
      const issues = validate("f:my_add a:Int b:Int -> Int => add(a, b)\nmy_add(1)");
      const errors = issues.filter(
        (i) => i.type === "error" && i.message.includes("argument"),
      );
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain("my_add");
      expect(errors[0].message).toContain("2 arguments");
      expect(errors[0].message).toContain("got 1");
    });

    it("should error when too many arguments are passed to a user function", () => {
      const issues = validate("f:double x:Int -> Int => mul(x, 2)\ndouble(5, 6)");
      const errors = issues.filter(
        (i) => i.type === "error" && i.message.includes("argument"),
      );
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain("double");
      expect(errors[0].message).toContain("1 argument");
      expect(errors[0].message).toContain("got 2");
    });

    it("should pass when argument count matches exactly", () => {
      const issues = validate("f:my_add a:Int b:Int -> Int => add(a, b)\nmy_add(1, 2)");
      const errors = issues.filter(
        (i) => i.type === "error" && i.message.includes("argument"),
      );
      expect(errors.length).toBe(0);
    });

    it("should pass for zero-argument functions called with no args", () => {
      const issues = validate('f:greet -> String => concat("Hello", "!")\ngreet()');
      const errors = issues.filter((i) => i.type === "error");
      expect(errors.length).toBe(0);
    });

    it("should error for zero-argument function called with args", () => {
      const issues = validate('f:greet -> String => concat("Hello", "!")\ngreet(42)');
      const errors = issues.filter(
        (i) => i.type === "error" && i.message.includes("argument"),
      );
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain("0 arguments");
      expect(errors[0].message).toContain("got 1");
    });

    it("should not check arity for stdlib functions", () => {
      const issues = validate("add(1, 2, 3)");
      const arityErrors = issues.filter(
        (i) => i.type === "error" && i.message.includes("argument"),
      );
      expect(arityErrors.length).toBe(0);
    });

    it("should check arity in pipe expressions", () => {
      const issues = validate("f:inc x:Int -> Int => add(x, 1)\n42 |> inc(_, 99)");
      const errors = issues.filter(
        (i) => i.type === "error" && i.message.includes("argument"),
      );
      expect(errors.length).toBeGreaterThan(0);
    });

    it("should pass arity check inside function bodies", () => {
      const issues = validate(
        "f:double x:Int -> Int => mul(x, 2)\nf:quad x:Int -> Int => double(double(x))",
      );
      const errors = issues.filter(
        (i) => i.type === "error" && i.message.includes("argument"),
      );
      expect(errors.length).toBe(0);
    });
  });

  describe("string interpolation", () => {
    it("should pass when interpolated identifiers are defined", () => {
      const issues = validate('f:greet name:String -> String => "Hello #{name}"');
      const errors = issues.filter((i) => i.type === "error");
      expect(errors.length).toBe(0);
    });

    it("should error on undefined identifier inside interpolation", () => {
      const issues = validate('"Hello #{ghost}"');
      const errors = issues.filter((i) => i.type === "error");
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain("ghost");
    });
  });
});
