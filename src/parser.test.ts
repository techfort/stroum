import { Lexer } from './lexer';
import { Parser } from './parser';
import * as AST from './ast';

describe('Parser', () => {
  const parse = (source: string): AST.Module => {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    return parser.parse();
  };

  describe('function declarations', () => {
    it('should parse simple function', () => {
      const ast = parse('f:double n => multiply(n, 2)');
      expect(ast.definitions).toHaveLength(1);
      
      const func = ast.definitions[0] as AST.FunctionDeclaration;
      expect(func.type).toBe('FunctionDeclaration');
      expect(func.name).toBe('double');
      expect(func.params).toEqual(['n']);
      expect(func.isRecursive).toBe(false);
      expect(func.emissionContract).toBeNull();
    });

    it('should parse function with multiple parameters', () => {
      const ast = parse('f:add a b => add(a, b)');
      const func = ast.definitions[0] as AST.FunctionDeclaration;
      expect(func.params).toEqual(['a', 'b']);
    });

    it('should parse recursive function', () => {
      const ast = parse('rec f:fib n => multiply(n, 2)');
      const func = ast.definitions[0] as AST.FunctionDeclaration;
      expect(func.isRecursive).toBe(true);
    });

    it('should parse function with emission contract', () => {
      const ast = parse('f:fetch url ~> @"ok", @"fail" => http_get(url)');
      const func = ast.definitions[0] as AST.FunctionDeclaration;
      expect(func.emissionContract).toEqual(['ok', 'fail']);
    });

    it('should parse function with indented body', () => {
      const source = `f:process data =>
  :result transform(data)
  result`;
      const ast = parse(source);
      const func = ast.definitions[0] as AST.FunctionDeclaration;
      expect(func.body.type).toBe('IndentedBody');
      const body = func.body as AST.IndentedBody;
      expect(body.statements).toHaveLength(2);
    });
  });

  describe('binding declarations', () => {
    it('should parse binding with colon', () => {
      const ast = parse(':a 42');
      expect(ast.definitions).toHaveLength(1);
      
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      expect(binding.type).toBe('BindingDeclaration');
      expect(binding.name).toBe('a');
      expect(binding.hasExplicitSigil).toBe(false);
      expect((binding.value as AST.NumberLiteral).value).toBe(42);
    });

    it('should parse binding with explicit b: sigil', () => {
      const ast = parse('b: :value 100');
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      expect(binding.hasExplicitSigil).toBe(true);
    });

    it('should parse binding with expression', () => {
      const ast = parse(':nums [1, 2, 3]');
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      expect(binding.value.type).toBe('ListLiteral');
    });
  });

  describe('struct declarations', () => {
    it('should parse struct', () => {
      const source = `s:User {
  name: String
  age: Int
}`;
      const ast = parse(source);
      expect(ast.definitions).toHaveLength(1);
      
      const struct = ast.definitions[0] as AST.StructDeclaration;
      expect(struct.type).toBe('StructDeclaration');
      expect(struct.name).toBe('User');
      expect(struct.fields).toHaveLength(2);
      expect(struct.fields[0]).toEqual({ name: 'name', typeName: 'String' });
      expect(struct.fields[1]).toEqual({ name: 'age', typeName: 'Int' });
    });
  });

  describe('literals', () => {
    it('should parse number literals', () => {
      const ast = parse(':a 42');
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const num = binding.value as AST.NumberLiteral;
      expect(num.type).toBe('NumberLiteral');
      expect(num.value).toBe(42);
    });

    it('should parse float literals', () => {
      const ast = parse(':pi 3.14');
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const num = binding.value as AST.NumberLiteral;
      expect(num.value).toBe(3.14);
    });

    it('should parse string literals', () => {
      const ast = parse(':msg "hello"');
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const str = binding.value as AST.StringLiteral;
      expect(str.type).toBe('StringLiteral');
      expect(str.value).toBe('hello');
      expect(str.hasInterpolation).toBe(false);
    });

    it('should detect string interpolation', () => {
      const ast = parse(':msg "hello #{name}"');
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const str = binding.value as AST.StringLiteral;
      expect(str.hasInterpolation).toBe(true);
    });

    it('should parse boolean literals', () => {
      const ast = parse(':flag true');
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const bool = binding.value as AST.BooleanLiteral;
      expect(bool.type).toBe('BooleanLiteral');
      expect(bool.value).toBe(true);
    });

    it('should parse list literals', () => {
      const ast = parse(':nums [1, 2, 3]');
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const list = binding.value as AST.ListLiteral;
      expect(list.type).toBe('ListLiteral');
      expect(list.elements).toHaveLength(3);
    });

    it('should parse empty list', () => {
      const ast = parse(':empty []');
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const list = binding.value as AST.ListLiteral;
      expect(list.elements).toHaveLength(0);
    });

    it('should parse record literals', () => {
      const ast = parse(':user User { name: "Joe", age: 47 }');
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const record = binding.value as AST.RecordLiteral;
      expect(record.type).toBe('RecordLiteral');
      expect(record.typeName).toBe('User');
      expect(record.fields).toHaveLength(2);
      expect(record.fields[0].name).toBe('name');
      expect(record.fields[1].name).toBe('age');
    });
  });

  describe('expressions', () => {
    it('should parse identifier', () => {
      const ast = parse(':a value');
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const ident = binding.value as AST.Identifier;
      expect(ident.type).toBe('Identifier');
      expect(ident.name).toBe('value');
    });

    it('should parse function call', () => {
      const ast = parse(':result double(21)');
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const call = binding.value as AST.CallExpression;
      expect(call.type).toBe('CallExpression');
      expect(call.callee).toBe('double');
      expect(call.args).toHaveLength(1);
    });

    it('should parse function call with multiple args', () => {
      const ast = parse(':sum add(1, 2, 3)');
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const call = binding.value as AST.CallExpression;
      expect(call.args).toHaveLength(3);
    });

    it('should parse function call with no args', () => {
      const ast = parse(':val get()');
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const call = binding.value as AST.CallExpression;
      expect(call.args).toHaveLength(0);
    });

    it('should parse lambda', () => {
      const ast = parse(':fn |:x| => multiply(x, 2)');
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const lambda = binding.value as AST.Lambda;
      expect(lambda.type).toBe('Lambda');
      expect(lambda.params).toEqual(['x']);
    });

    it('should parse lambda with multiple params', () => {
      const ast = parse(':fn |:a, :b| => add(a, b)');
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const lambda = binding.value as AST.Lambda;
      expect(lambda.params).toEqual(['a', 'b']);
    });

    it('should parse lambda with no params', () => {
      const ast = parse(':fn || => 42');
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const lambda = binding.value as AST.Lambda;
      expect(lambda.params).toHaveLength(0);
    });
  });

  describe('pipe expressions', () => {
    it('should parse simple pipe', () => {
      const ast = parse(':result nums |> double');
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const pipe = binding.value as AST.PipeExpression;
      expect(pipe.type).toBe('PipeExpression');
      expect(pipe.stages).toHaveLength(2);
    });

    it('should parse pipe chain', () => {
      const ast = parse(':result nums |> filter(|:v| => gt(v, 0)) |> map(|:v| => double(v))');
      const binding = ast.definitions[0] as AST.BindingDeclaration;
      const pipe = binding.value as AST.PipeExpression;
      expect(pipe.stages).toHaveLength(3);
    });

    it('should parse pipe with stream emit', () => {
      const ast = parse('nums |> double @"results"');
      const pipe = ast.primaryExpressions[0] as AST.PipeExpression;
      expect(pipe.streamEmit).not.toBeNull();
      expect(pipe.streamEmit?.streams[0]).toEqual({ name: 'results', isDynamic: false });
      expect(pipe.streamEmit?.isRedirect).toBe(false);
    });

    it('should parse pipe with dynamic stream name from binding', () => {
      const ast = parse(':ch "ok"\nnums |> double @ ch');
      const pipe = ast.primaryExpressions[0] as AST.PipeExpression;
      expect(pipe.streamEmit).not.toBeNull();
      expect(pipe.streamEmit?.streams[0]).toEqual({ name: 'ch', isDynamic: true });
    });

    it('should parse pipe with redirect', () => {
      const ast = parse('nums |> double @>"results"');
      const pipe = ast.primaryExpressions[0] as AST.PipeExpression;
      expect(pipe.streamEmit?.isRedirect).toBe(true);
    });

    it('should parse pipe with fan-out emit', () => {
      const ast = parse('process(data) @("ok", "audit")');
      const pipe = ast.primaryExpressions[0] as AST.PipeExpression;
      expect(pipe.streamEmit?.streams.map(s => s.name)).toEqual(['ok', 'audit']);
      expect(pipe.streamEmit?.streams.every(s => !s.isDynamic)).toBe(true);
    });

    it('should parse pipe with stream termination', () => {
      const ast = parse('final() @"ok"XX');
      const pipe = ast.primaryExpressions[0] as AST.PipeExpression;
      expect(pipe.streamEmit?.terminates).toBe(true);
    });

    it('should parse pipe with outcome match', () => {
      const source = `fetch(url)
| .fail => log(url)`;
      const ast = parse(source);
      const pipe = ast.primaryExpressions[0] as AST.PipeExpression;
      expect(pipe.outcomeMatches).toHaveLength(1);
      expect(pipe.outcomeMatches[0].tag.name).toBe('fail');
    });

    it('should parse pipe with string literal tag in outcome match', () => {
      const source = `process(x)
| ."just right" => println`;
      const ast = parse(source);
      const pipe = ast.primaryExpressions[0] as AST.PipeExpression;
      expect(pipe.outcomeMatches).toHaveLength(1);
      expect(pipe.outcomeMatches[0].tag.name).toBe('just right');
    });

    it('should parse tagged expression producer with identifier tag', () => {
      const ast = parse('f:wrap x => .ok x');
      const fn = ast.definitions[0] as AST.FunctionDeclaration;
      const body = fn.body as AST.TaggedExpression;
      expect(body.type).toBe('TaggedExpression');
      expect(body.tag.name).toBe('ok');
    });

    it('should parse tagged expression producer with string literal tag', () => {
      const ast = parse('f:wrap x => ."just right" x');
      const fn = ast.definitions[0] as AST.FunctionDeclaration;
      const body = fn.body as AST.TaggedExpression;
      expect(body.type).toBe('TaggedExpression');
      expect(body.tag.name).toBe('just right');
    });

    it('should parse pipe with multiple outcome matches', () => {
      const source = `fetch(url)
| .fail => log(url) @"errors"
| .timeout => retry() @"retries"`;
      const ast = parse(source);
      const pipe = ast.primaryExpressions[0] as AST.PipeExpression;
      expect(pipe.outcomeMatches).toHaveLength(2);
      expect(pipe.outcomeMatches[0].tag.name).toBe('fail');
      expect(pipe.outcomeMatches[1].tag.name).toBe('timeout');
    });
  });

  describe('parallel expressions', () => {
    it('should parse parallel composition', () => {
      const ast = parse('fetch(a) PP fetch(b) |> merge');
      const parallel = ast.primaryExpressions[0] as AST.ParallelExpression;
      expect(parallel.type).toBe('ParallelExpression');
      expect(parallel.branches).toHaveLength(2);
      expect(parallel.gatherPipe.isPartial).toBe(false);
    });

    it('should parse partial parallel', () => {
      const ast = parse('fetch(a) PP fetch(b) |?> merge');
      const parallel = ast.primaryExpressions[0] as AST.ParallelExpression;
      expect(parallel.gatherPipe.isPartial).toBe(true);
    });

    it('should parse parallel with multiple branches', () => {
      const ast = parse('fetch(a) PP fetch(b) PP fetch(c) |> merge');
      const parallel = ast.primaryExpressions[0] as AST.ParallelExpression;
      expect(parallel.branches).toHaveLength(3);
    });

    it('should parse parallel with stream emit', () => {
      const ast = parse('fetch(a) PP fetch(b) |> merge @"ok"');
      const parallel = ast.primaryExpressions[0] as AST.ParallelExpression;
      expect(parallel.gatherPipe.streamEmit).not.toBeNull();
    });
  });

  describe('on handlers', () => {
    it('should parse on handler', () => {
      const ast = parse('on @"errors" |> |:e| => store(e)');
      expect(ast.contingencies).toHaveLength(1);
      
      const handler = ast.contingencies[0] as AST.OnHandler;
      expect(handler.type).toBe('OnHandler');
      expect(handler.streamPattern).toBe('errors');
      expect(handler.handler.type).toBe('Lambda');
    });

    it('should parse on handler with wildcard', () => {
      const ast = parse('on @"api.*" |> |:e| => log(e)');
      const handler = ast.contingencies[0] as AST.OnHandler;
      expect(handler.streamPattern).toBe('api.*');
    });

    it('should parse on handler with emit', () => {
      const ast = parse('on @"errors" |> |:e| => store(e) @"audit"');
      const handler = ast.contingencies[0] as AST.OnHandler;
      expect(handler.streamEmit).not.toBeNull();
      expect(handler.streamEmit?.streams[0]).toEqual({ name: 'audit', isDynamic: false });
    });
  });

  describe('route declarations', () => {
    it('should parse simple route', () => {
      const ast = parse('op1()\n\nroute @"ok" |> op2');
      expect(ast.contingencies).toHaveLength(1);
      const route = ast.contingencies[0] as AST.RouteDeclaration;
      expect(route.type).toBe('RouteDeclaration');
      expect(route.streamPattern).toEqual({ name: 'ok', isDynamic: false });
    });

    it('should parse route with pipe chain', () => {
      const ast = parse('op1()\n\nroute @"ok" |> op2 |> op3');
      const route = ast.contingencies[0] as AST.RouteDeclaration;
      expect(route.type).toBe('RouteDeclaration');
      expect(route.streamPattern).toEqual({ name: 'ok', isDynamic: false });
      expect(route.pipeline.type).toBe('PipeExpression');
    });

    it('should parse route with dynamic stream binding', () => {
      const ast = parse('op1()\n\nroute @ mystream |> handler');
      const route = ast.contingencies[0] as AST.RouteDeclaration;
      expect(route.type).toBe('RouteDeclaration');
      expect(route.streamPattern).toEqual({ name: 'mystream', isDynamic: true });
    });

    it('should parse route and on handler together', () => {
      const ast = parse('op1()\n\nroute @"ok" |> op2\non @"fail" |> |:x| => rescue(x)');
      expect(ast.contingencies).toHaveLength(2);
      expect(ast.contingencies[0].type).toBe('RouteDeclaration');
      expect(ast.contingencies[1].type).toBe('OnHandler');
    });
  });

  describe('complete programs', () => {
    it('should parse test case 1: pure function', () => {
      const source = `f:double n => multiply(n, 2)
double(21) @"ok"`;
      const ast = parse(source);
      expect(ast.definitions).toHaveLength(1);
      expect(ast.primaryExpressions.length).toBeGreaterThan(0);
    });

    it('should parse test case 2: pipe chain', () => {
      const source = `:nums [1, 2, 3, 4, 5]
nums |> filter(|:v| => gt(v, 2)) |> map(|:v| => multiply(v, 10)) @"ok"`;
      const ast = parse(source);
      expect(ast.definitions).toHaveLength(1);
      expect(ast.primaryExpressions.length).toBeGreaterThan(0);
    });

    it('should parse test case 3: named outcomes', () => {
      const source = `f:find_user id ~> @"found", @"not_found" =>
  lookup(id) @"found"
  | .empty => @"not_found"

find_user(42)
| .not_found => create_guest() @>"found"`;
      const ast = parse(source);
      expect(ast.definitions).toHaveLength(1);
      expect(ast.primaryExpressions.length).toBeGreaterThan(0);
    });

    it('should parse test case 4: parallel composition', () => {
      const source = `fetch(url_a) PP fetch(url_b) |> merge @"ok"
| .fail => log() @"errors"`;
      const ast = parse(source);
      expect(ast.primaryExpressions.length).toBeGreaterThan(0);
      expect((ast.primaryExpressions[0] as AST.ParallelExpression).type).toBe('ParallelExpression');
    });

    it('should parse test case 5: on handler with wildcard', () => {
      const source = `on @"errors" |> |:e| => store(e) @"audit"
on @"api.*"  |> |:e| => log(e)`;
      const ast = parse(source);
      expect(ast.contingencies).toHaveLength(2);
    });

    it('should parse mixed definitions and primary expression', () => {
      const source = `f:double n => multiply(n, 2)
:nums [1, 2, 3]
nums |> map(|:x| => double(x)) @"results"`;
      const ast = parse(source);
      expect(ast.definitions).toHaveLength(2);
      expect(ast.primaryExpressions.length).toBeGreaterThan(0);
    });

    it('should parse multiple primary expressions', () => {
      const source = `f:op x => x @ "ok"
op(1)
op(2)
op(3)`;
      const ast = parse(source);
      expect(ast.primaryExpressions).toHaveLength(3);
    });
  });

  describe('error handling', () => {
    it('should throw on unexpected token', () => {
      expect(() => parse('f:foo => }')).toThrow(/error/);
    });

    it('should throw on missing parameter', () => {
      expect(() => parse('f:foo => bar(')).toThrow(/error/);
    });

    it('should provide line and column in errors', () => {
      expect(() => {
        parse('f:foo bar\nbaz'); // Missing => after parameters
      }).toThrow(/line \d+/);
      
      expect(() => {
        parse('f:foo bar\nbaz');
      }).toThrow(/col \d+/);
    });
  });
});
