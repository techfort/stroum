import type * as AST from "./ast";
import { Lexer } from "./lexer";
import { Parser } from "./parser";

describe("Parser", () => {
  const parse = (source: string): AST.Module => {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    return parser.parse();
  };

  const parseErrors = (source: string) => {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    parser.parse();
    return parser.diagnostics;
  };

  describe("function declarations", () => {
    it("should parse simple function", () => {
      const ast = parse("f:double n:Any -> Any => multiply(n, 2)");
      expect(ast.definitions).toHaveLength(1);

      const func = ast.definitions[0] as AST.FunctionDeclaration;
      expect(func.type).toBe("FunctionDeclaration");
      expect(func.name).toBe("double");
      expect(func.params).toEqual(["n"]);
      expect(func.paramTypes).toEqual(["Any"]);
      expect(func.returnType).toBe("Any");
      expect(func.isRecursive).toBe(false);
      expect(func.emissionContract).toBeNull();
    });

    it("should parse function with multiple parameters", () => {
      const ast = parse("f:add a:Any b:Any -> Any => add(a, b)");
      const func = ast.definitions[0] as AST.FunctionDeclaration;
      expect(func.params).toEqual(["a", "b"]);
      expect(func.paramTypes).toEqual(["Any", "Any"]);
    });

    it("should parse recursive function", () => {
      const ast = parse("rec f:fib n:Int -> Int => multiply(n, 2)");
      const func = ast.definitions[0] as AST.FunctionDeclaration;
      expect(func.isRecursive).toBe(true);
    });

    it("should parse function with emission contract", () => {
      const ast = parse('f:fetch url:String -> Any ~> @"ok", @"fail" => http_get(url)');
      const func = ast.definitions[0] as AST.FunctionDeclaration;
      expect(func.emissionContract).toEqual(["ok", "fail"]);
    });

    it("should parse function with indented body", () => {
      const source = `f:process data:Any -> Any =>
  :result transform(data)
  result`;
      const ast = parse(source);
      const func = ast.definitions[0] as AST.FunctionDeclaration;
      expect(func.body.type).toBe("IndentedBody");
      const body = func.body as AST.IndentedBody;
      expect(body.statements).toHaveLength(2);
    });

    it("should parse postfix field access with dot syntax", () => {
      const ast = parse("f:is_adult user:Any -> Bool => gt(user.age, 18)");
      const func = ast.definitions[0] as AST.FunctionDeclaration;
      const body = func.body as AST.CallExpression;
      const access = body.args[0] as AST.FieldAccessExpression;

      expect(body.type).toBe("CallExpression");
      expect(body.callee).toBe("gt");
      expect(access.type).toBe("FieldAccessExpression");
      expect(access.field).toBe("age");
      expect((access.receiver as AST.Identifier).name).toBe("user");
    });
  });

  describe("source and runtime declarations", () => {
    it("should parse source declaration after a bare import without treating it as a selective import", () => {
      const ast = parse('i:timer\nsrc: @"ticks" watch_file("watched.txt")');
      expect(ast.imports).toHaveLength(1);
      expect(ast.imports[0].modulePath).toBe("timer");
      expect(ast.imports[0].imports).toBeNull();
      expect(ast.sourceDeclarations).toHaveLength(1);
    });

    it("should parse src declarations interleaved with other declarations", () => {
      const source = `i:io
:watched_file "examples/watched.txt"
src: @"change" watch_file(watched_file)
f:identity x:Any -> Any => x`;
      const ast = parse(source);

      expect(ast.imports).toHaveLength(1);
      expect(ast.definitions).toHaveLength(2);
      expect(ast.sourceDeclarations).toHaveLength(1);
      expect((ast.definitions[0] as AST.BindingDeclaration).name).toBe(
        "watched_file",
      );
      expect((ast.definitions[1] as AST.FunctionDeclaration).name).toBe(
        "identity",
      );
      expect(ast.sourceDeclarations[0].stream).toEqual({
        name: "change",
        isDynamic: false,
      });
    });

    it("should parse finite source declaration", () => {
      const ast = parse('src: @"orders" file("orders.csv")');
      expect(ast.sourceDeclarations).toHaveLength(1);

      const source = ast.sourceDeclarations[0];
      expect(source.type).toBe("SourceDeclaration");
      expect(source.stream).toEqual({ name: "orders", isDynamic: false });
      expect(source.source.type).toBe("CallExpression");
      expect((source.source as AST.CallExpression).callee).toBe("file");
    });

    it("should parse to declaration in the declaration region", () => {
      const ast = parse('snk: @"orders.clean" persist_order');
      expect(ast.sinkDeclarations).toHaveLength(1);
      const sink = ast.sinkDeclarations[0];
      expect(sink.type).toBe("SinkDeclaration");
      expect(sink.stream).toEqual({ name: "orders.clean", isDynamic: false });
      expect(sink.sink.type).toBe("Identifier");
      expect((sink.sink as AST.Identifier).name).toBe("persist_order");
    });

    it("should parse a test declaration with label and body", () => {
      const source = `test "add returns correct sum" =>
  assert_eq(add(2, 3), 5)`;
      const ast = parse(source);
      expect(ast.testDeclarations).toHaveLength(1);
      const td = ast.testDeclarations[0];
      expect(td.type).toBe("TestDeclaration");
      expect(td.label).toBe("add returns correct sum");
      expect(td.body.statements).toHaveLength(1);
    });

    it("should parse multiple test declarations alongside function definitions", () => {
      const source = `f:double x:Int -> Int => mul(x, 2)

test "double two" =>
  assert_eq(double(2), 4)

test "double zero" =>
  assert_eq(double(0), 0)`;
      const ast = parse(source);
      expect(ast.definitions).toHaveLength(1);
      expect(ast.testDeclarations).toHaveLength(2);
      expect(ast.testDeclarations[0].label).toBe("double two");
      expect(ast.testDeclarations[1].label).toBe("double zero");
    });

    it("should parse src and to declarations interleaved with other declarations", () => {
      const source = `i:io
:watched_file "examples/watched.txt"
src: @"change" watch_file(watched_file)
snk: @"change" handle_change
f:identity x:Any -> Any => x`;
      const ast = parse(source);

      expect(ast.sourceDeclarations).toHaveLength(1);
      expect(ast.sinkDeclarations).toHaveLength(1);
      expect(ast.definitions).toHaveLength(2);
    });

    it("should parse open-ended source and run-until-signal declaration", () => {
      const source = `src: @"changes" watch_file("watched.txt")
run until signal`;
      const ast = parse(source);

      expect(ast.sourceDeclarations).toHaveLength(1);
      expect(ast.runtimeDeclaration?.type).toBe("RunUntilDeclaration");
      expect(
        (ast.runtimeDeclaration as AST.RunUntilDeclaration).condition.type,
      ).toBe("SignalCondition");
    });

    it("should parse run until stream declaration after contingencies", () => {
      const source = `src: @"jobs" cron("0 * * * *")
route @"jobs" |> handle_job
run until @"shutdown"`;
      const ast = parse(source);

      expect(ast.contingencies).toHaveLength(1);
      expect(ast.runtimeDeclaration?.type).toBe("RunUntilDeclaration");
      const condition = (ast.runtimeDeclaration as AST.RunUntilDeclaration)
        .condition as AST.StreamCondition;
      expect(condition.type).toBe("StreamCondition");
      expect(condition.stream).toEqual({ name: "shutdown", isDynamic: false });
    });

    it("should parse run until timeout declaration", () => {
      const ast = parse("run until timeout(5)");
      expect(ast.runtimeDeclaration?.type).toBe("RunUntilDeclaration");
      const condition = (ast.runtimeDeclaration as AST.RunUntilDeclaration)
        .condition as AST.TimeoutCondition;
      expect(condition.type).toBe("TimeoutCondition");
      expect(condition.duration.type).toBe("CallExpression");
      expect((condition.duration as AST.CallExpression).callee).toBe("timeout");
    });
  });

  describe("binding declarations", () => {
    it("should parse binding with colon", () => {
      const ast = parse(":a 42");
      expect(ast.definitions).toHaveLength(1);

      const binding = ast.definitions[0] as AST.BindingDeclaration;
      expect(binding.type).toBe("BindingDeclaration");
      expect(binding.name).toBe("a");
      expect(binding.hasExplicitSigil).toBe(false);
      expect((binding.value as AST.NumberLiteral).value).toBe(42);
    });

    it("should parse binding with explicit b: sigil", () => {
      const ast = parse("b: :value 100");
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      expect(binding.hasExplicitSigil).toBe(true);
    });

    it("should parse binding with expression", () => {
      const ast = parse(":nums [1, 2, 3]");
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      expect(binding.value.type).toBe("ListLiteral");
    });
  });

  describe("struct declarations", () => {
    it("should parse struct", () => {
      const source = `s:User {
  name: String
  age: Int
}`;
      const ast = parse(source);
      expect(ast.definitions).toHaveLength(1);

      const struct = ast.definitions[0] as AST.StructDeclaration;
      expect(struct.type).toBe("StructDeclaration");
      expect(struct.name).toBe("User");
      expect(struct.fields).toHaveLength(2);
      expect(struct.fields[0]).toEqual({ name: "name", typeName: "String" });
      expect(struct.fields[1]).toEqual({ name: "age", typeName: "Int" });
    });
  });

  describe("literals", () => {
    it("should parse number literals", () => {
      const ast = parse(":a 42");
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const num = binding.value as AST.NumberLiteral;
      expect(num.type).toBe("NumberLiteral");
      expect(num.value).toBe(42);
    });

    it("should parse float literals", () => {
      const ast = parse(":pi 3.14");
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const num = binding.value as AST.NumberLiteral;
      expect(num.value).toBe(3.14);
    });

    it("should parse string literals", () => {
      const ast = parse(':msg "hello"');
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const str = binding.value as AST.StringLiteral;
      expect(str.type).toBe("StringLiteral");
      expect(str.value).toBe("hello");
      expect(str.hasInterpolation).toBe(false);
    });

    it("should detect string interpolation", () => {
      const ast = parse(':msg "hello #{name}"');
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const str = binding.value as AST.InterpolatedStringLiteral;
      expect(str.type).toBe("InterpolatedStringLiteral");
      expect(str.segments).toHaveLength(2);
      expect(str.segments[0]).toEqual({ kind: "text", value: "hello " });
      expect(str.segments[1].kind).toBe("expr");
    });

    it("should parse multi-segment string interpolation", () => {
      const ast = parse(':msg "#{a} and #{b}"');
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const str = binding.value as AST.InterpolatedStringLiteral;
      expect(str.type).toBe("InterpolatedStringLiteral");
      expect(str.segments).toHaveLength(3); // expr, text, expr
      expect(str.segments[0].kind).toBe("expr");
      expect(str.segments[1]).toEqual({ kind: "text", value: " and " });
      expect(str.segments[2].kind).toBe("expr");
    });

    it("should parse interpolation with function call expression", () => {
      const ast = parse(':msg "total: #{add(1, 2)}"');
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const str = binding.value as AST.InterpolatedStringLiteral;
      expect(str.type).toBe("InterpolatedStringLiteral");
      const exprSeg = str.segments[1] as {
        kind: "expr";
        expression: AST.CallExpression;
      };
      expect(exprSeg.kind).toBe("expr");
      expect(exprSeg.expression.type).toBe("CallExpression");
      expect((exprSeg.expression as AST.CallExpression).callee).toBe("add");
    });

    it("should parse boolean literals", () => {
      const ast = parse(":flag true");
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const bool = binding.value as AST.BooleanLiteral;
      expect(bool.type).toBe("BooleanLiteral");
      expect(bool.value).toBe(true);
    });

    it("should parse list literals", () => {
      const ast = parse(":nums [1, 2, 3]");
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const list = binding.value as AST.ListLiteral;
      expect(list.type).toBe("ListLiteral");
      expect(list.elements).toHaveLength(3);
    });

    it("should parse empty list", () => {
      const ast = parse(":empty []");
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const list = binding.value as AST.ListLiteral;
      expect(list.elements).toHaveLength(0);
    });

    it("should parse record literals", () => {
      const ast = parse(':user User { name: "Joe", age: 47 }');
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const record = binding.value as AST.RecordLiteral;
      expect(record.type).toBe("RecordLiteral");
      expect(record.typeName).toBe("User");
      expect(record.fields).toHaveLength(2);
      expect(record.fields[0].name).toBe("name");
      expect(record.fields[1].name).toBe("age");
    });
  });

  describe("expressions", () => {
    it("should parse identifier", () => {
      const ast = parse(":a value");
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const ident = binding.value as AST.Identifier;
      expect(ident.type).toBe("Identifier");
      expect(ident.name).toBe("value");
    });

    it("should parse function call", () => {
      const ast = parse(":result double(21)");
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const call = binding.value as AST.CallExpression;
      expect(call.type).toBe("CallExpression");
      expect(call.callee).toBe("double");
      expect(call.args).toHaveLength(1);
    });

    it("should parse function call with multiple args", () => {
      const ast = parse(":sum add(1, 2, 3)");
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const call = binding.value as AST.CallExpression;
      expect(call.args).toHaveLength(3);
    });

    it("should parse function call with no args", () => {
      const ast = parse(":val get()");
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const call = binding.value as AST.CallExpression;
      expect(call.args).toHaveLength(0);
    });

    it("should parse lambda", () => {
      const ast = parse(":fn |:x:Any| => multiply(x, 2)");
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const lambda = binding.value as AST.Lambda;
      expect(lambda.type).toBe("Lambda");
      expect(lambda.params).toEqual(["x"]);
      expect(lambda.paramTypes).toEqual(["Any"]);
    });

    it("should parse lambda with multiple params", () => {
      const ast = parse(":fn |:a:Any, :b:Any| => add(a, b)");
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const lambda = binding.value as AST.Lambda;
      expect(lambda.params).toEqual(["a", "b"]);
      expect(lambda.paramTypes).toEqual(["Any", "Any"]);
    });

    it("should parse lambda with no params", () => {
      const ast = parse(":fn || => 42");
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const lambda = binding.value as AST.Lambda;
      expect(lambda.params).toHaveLength(0);
    });
  });

  describe("pipe expressions", () => {
    it("should parse simple pipe", () => {
      const ast = parse(":result nums |> double");
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const pipe = binding.value as AST.PipeExpression;
      expect(pipe.type).toBe("PipeExpression");
      expect(pipe.stages).toHaveLength(2);
    });

    it("should parse pipe chain", () => {
      const ast = parse(
        ":result nums |> filter(|:v:Any| => gt(v, 0)) |> map(|:v:Any| => double(v))",
      );
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const pipe = binding.value as AST.PipeExpression;
      expect(pipe.stages).toHaveLength(3);
    });

    it("should parse pipe with stream emit", () => {
      const ast = parse('nums |> double @"results"');
      const pipe = ast.primaryExpressions[0] as AST.PipeExpression;
      expect(pipe.streamEmit).not.toBeNull();
      expect(pipe.streamEmit?.streams[0]).toEqual({
        name: "results",
        isDynamic: false,
      });
      expect(pipe.streamEmit?.isRedirect).toBe(false);
    });

    it("should parse pipe with dynamic stream name from binding", () => {
      const ast = parse(':ch "ok"\nnums |> double @ ch');
      const pipe = ast.primaryExpressions[0] as AST.PipeExpression;
      expect(pipe.streamEmit).not.toBeNull();
      expect(pipe.streamEmit?.streams[0]).toEqual({
        name: "ch",
        isDynamic: true,
      });
    });

    it("should parse pipe with redirect", () => {
      const ast = parse('nums |> double @>"results"');
      const pipe = ast.primaryExpressions[0] as AST.PipeExpression;
      expect(pipe.streamEmit?.isRedirect).toBe(true);
    });

    it("should parse pipe with fan-out emit", () => {
      const ast = parse('process(data) @("ok", "audit")');
      const pipe = ast.primaryExpressions[0] as AST.PipeExpression;
      expect(pipe.streamEmit?.streams.map((s) => s.name)).toEqual([
        "ok",
        "audit",
      ]);
      expect(pipe.streamEmit?.streams.every((s) => !s.isDynamic)).toBe(true);
    });

    it("should parse pipe with stream termination", () => {
      const ast = parse('final() @"ok"XX');
      const pipe = ast.primaryExpressions[0] as AST.PipeExpression;
      expect(pipe.streamEmit?.terminates).toBe(true);
    });

    it("should parse pipe with outcome match", () => {
      const source = `fetch(url)
| .fail => log(url)`;
      const ast = parse(source);
      const pipe = ast.primaryExpressions[0] as AST.PipeExpression;
      expect(pipe.outcomeMatches).toHaveLength(1);
      expect(pipe.outcomeMatches[0].tag.name).toBe("fail");
    });

    it("should parse pipe with string literal tag in outcome match", () => {
      const source = `process(x)
| ."just right" => println`;
      const ast = parse(source);
      const pipe = ast.primaryExpressions[0] as AST.PipeExpression;
      expect(pipe.outcomeMatches).toHaveLength(1);
      expect(pipe.outcomeMatches[0].tag.name).toBe("just right");
    });

    it("should parse tagged expression producer with identifier tag", () => {
      const ast = parse("f:wrap x:Any -> Any => .ok x");
      const fn = ast.definitions[0] as AST.FunctionDeclaration;
      const body = fn.body as AST.TaggedExpression;
      expect(body.type).toBe("TaggedExpression");
      expect(body.tag.name).toBe("ok");
    });

    it("should parse tagged expression producer with string literal tag", () => {
      const ast = parse('f:wrap x:Any -> Any => ."just right" x');
      const fn = ast.definitions[0] as AST.FunctionDeclaration;
      const body = fn.body as AST.TaggedExpression;
      expect(body.type).toBe("TaggedExpression");
      expect(body.tag.name).toBe("just right");
    });

    it("should parse pipe with multiple outcome matches", () => {
      const source = `fetch(url)
| .fail => log(url) @"errors"
| .timeout => retry() @"retries"`;
      const ast = parse(source);
      const pipe = ast.primaryExpressions[0] as AST.PipeExpression;
      expect(pipe.outcomeMatches).toHaveLength(2);
      expect(pipe.outcomeMatches[0].tag.name).toBe("fail");
      expect(pipe.outcomeMatches[1].tag.name).toBe("timeout");
    });
  });

  describe("parallel expressions", () => {
    it("should parse parallel composition", () => {
      const ast = parse("fetch(a) PP fetch(b) |> merge");
      const parallel = ast.primaryExpressions[0] as AST.ParallelExpression;
      expect(parallel.type).toBe("ParallelExpression");
      expect(parallel.branches).toHaveLength(2);
      expect(parallel.gatherPipe.isPartial).toBe(false);
    });

    it("should parse partial parallel", () => {
      const ast = parse("fetch(a) PP fetch(b) |?> merge");
      const parallel = ast.primaryExpressions[0] as AST.ParallelExpression;
      expect(parallel.gatherPipe.isPartial).toBe(true);
    });

    it("should parse parallel with multiple branches", () => {
      const ast = parse("fetch(a) PP fetch(b) PP fetch(c) |> merge");
      const parallel = ast.primaryExpressions[0] as AST.ParallelExpression;
      expect(parallel.branches).toHaveLength(3);
    });

    it("should parse parallel with stream emit", () => {
      const ast = parse('fetch(a) PP fetch(b) |> merge @"ok"');
      const parallel = ast.primaryExpressions[0] as AST.ParallelExpression;
      expect(parallel.gatherPipe.streamEmit).not.toBeNull();
    });
  });

  describe("on handlers", () => {
    it("should parse on handler", () => {
      const ast = parse('on @"errors" |> |:e:Any| => store(e)');
      expect(ast.contingencies).toHaveLength(1);

      const handler = ast.contingencies[0] as AST.OnHandler;
      expect(handler.type).toBe("OnHandler");
      expect(handler.streamPattern).toBe("errors");
      expect(handler.handler.type).toBe("Lambda");
    });

    it("should parse on handler with wildcard", () => {
      const ast = parse('on @"api.*" |> |:e:Any| => log(e)');
      const handler = ast.contingencies[0] as AST.OnHandler;
      expect(handler.streamPattern).toBe("api.*");
    });

    it("should parse on handler with emit", () => {
      const ast = parse('on @"errors" |> |:e:Any| => store(e) @"audit"');
      const handler = ast.contingencies[0] as AST.OnHandler;
      expect(handler.streamEmit).not.toBeNull();
      expect(handler.streamEmit?.streams[0]).toEqual({
        name: "audit",
        isDynamic: false,
      });
    });
  });

  describe("route declarations", () => {
    it("should parse simple route", () => {
      const ast = parse('op1()\n\nroute @"ok" |> op2');
      expect(ast.contingencies).toHaveLength(1);
      const route = ast.contingencies[0] as AST.RouteDeclaration;
      expect(route.type).toBe("RouteDeclaration");
      expect(route.streamPattern).toEqual({ name: "ok", isDynamic: false });
    });

    it("should parse route with pipe chain", () => {
      const ast = parse('op1()\n\nroute @"ok" |> op2 |> op3');
      const route = ast.contingencies[0] as AST.RouteDeclaration;
      expect(route.type).toBe("RouteDeclaration");
      expect(route.streamPattern).toEqual({ name: "ok", isDynamic: false });
      expect(route.pipeline.type).toBe("PipeExpression");
    });

    it("should parse route with dynamic stream binding", () => {
      const ast = parse("op1()\n\nroute @ mystream |> handler");
      const route = ast.contingencies[0] as AST.RouteDeclaration;
      expect(route.type).toBe("RouteDeclaration");
      expect(route.streamPattern).toEqual({
        name: "mystream",
        isDynamic: true,
      });
    });

    it("should parse route and on handler together", () => {
      const ast = parse(
        'op1()\n\nroute @"ok" |> op2\non @"fail" |> |:x:Any| => rescue(x)',
      );
      expect(ast.contingencies).toHaveLength(2);
      expect(ast.contingencies[0].type).toBe("RouteDeclaration");
      expect(ast.contingencies[1].type).toBe("OnHandler");
    });
  });

  describe("complete programs", () => {
    it("should parse test case 1: pure function", () => {
      const source = `f:double n:Int -> Int => multiply(n, 2)
double(21) @"ok"`;
      const ast = parse(source);
      expect(ast.definitions).toHaveLength(1);
      expect(ast.primaryExpressions.length).toBeGreaterThan(0);
    });

    it("should parse test case 2: pipe chain", () => {
      const source = `:nums [1, 2, 3, 4, 5]
nums |> filter(|:v:Any| => gt(v, 2)) |> map(|:v:Any| => multiply(v, 10)) @"ok"`;
      const ast = parse(source);
      expect(ast.definitions).toHaveLength(1);
      expect(ast.primaryExpressions.length).toBeGreaterThan(0);
    });

    it("should parse test case 3: named outcomes", () => {
      const source = `f:find_user id:Any -> Any ~> @"found", @"not_found" =>
  lookup(id) @"found"
  | .empty => @"not_found"

find_user(42)
| .not_found => create_guest() @>"found"`;
      const ast = parse(source);
      expect(ast.definitions).toHaveLength(1);
      expect(ast.primaryExpressions.length).toBeGreaterThan(0);
    });

    it("should parse test case 4: parallel composition", () => {
      const source = `fetch(url_a) PP fetch(url_b) |> merge @"ok"
| .fail => log() @"errors"`;
      const ast = parse(source);
      expect(ast.primaryExpressions.length).toBeGreaterThan(0);
      expect((ast.primaryExpressions[0] as AST.ParallelExpression).type).toBe(
        "ParallelExpression",
      );
    });

    it("should parse test case 5: on handler with wildcard", () => {
      const source = `on @"errors" |> |:e:Any| => store(e) @"audit"
on @"api.*"  |> |:e:Any| => log(e)`;
      const ast = parse(source);
      expect(ast.contingencies).toHaveLength(2);
    });

    it("should parse mixed definitions and primary expression", () => {
      const source = `f:double n:Int -> Int => multiply(n, 2)
:nums [1, 2, 3]
nums |> map(|:x:Any| => double(x)) @"results"`;
      const ast = parse(source);
      expect(ast.definitions).toHaveLength(2);
      expect(ast.primaryExpressions.length).toBeGreaterThan(0);
    });

    it("should parse multiple primary expressions", () => {
      const source = `f:op x:Any -> Any => x @ "ok"
op(1)
op(2)
op(3)`;
      const ast = parse(source);
      expect(ast.primaryExpressions).toHaveLength(3);
    });
  });

  describe("error handling", () => {
    it("should record a diagnostic for unexpected token instead of throwing", () => {
      const errs = parseErrors("f:foo => }");
      expect(errs.length).toBeGreaterThan(0);
      expect(errs[0].stage).toBe("parse");
      expect(errs[0].severity).toBe("error");
    });

    it("should record a diagnostic for missing closing paren", () => {
      const errs = parseErrors("f:foo => bar(");
      expect(errs.length).toBeGreaterThan(0);
    });

    it("should provide structured line and column on parse errors", () => {
      const errs = parseErrors("f:foo bar\nbaz"); // Missing => after parameters
      expect(errs.length).toBeGreaterThan(0);
      expect(errs[0].line).toBeGreaterThanOrEqual(1);
      expect(errs[0].column).toBeGreaterThanOrEqual(1);
    });
  });
});
