import { Lexer } from './lexer';
import { Parser } from './parser';
import { Transpiler } from './transpiler';

function transpile(source: string): string {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const transpiler = new Transpiler();
  return transpiler.transpile(ast);
}

describe('Transpiler', () => {
  describe('literals', () => {
    it('should transpile number literal', () => {
      const output = transpile(':x 42');
      expect(output).toContain('const x = 42;');
    });

    it('should transpile string literal', () => {
      const output = transpile(':msg "hello"');
      expect(output).toContain('const msg = "hello";');
    });

    it('should transpile boolean literal', () => {
      const output = transpile(':flag true');
      expect(output).toContain('const flag = true;');
    });

    it('should transpile list literal', () => {
      const output = transpile(':nums [1, 2, 3]');
      expect(output).toContain('const nums = [1, 2, 3];');
    });

    it('should transpile record literal', () => {
      const output = transpile(':user User {name: "Alice", age: 30}');
      expect(output).toContain('const user = { name: "Alice", age: 30 };');
    });
  });

  describe('functions', () => {
    it('should transpile simple function', () => {
      const output = transpile('f:double n => multiply(n, 2)');
      expect(output).toContain('async function double(n)');
      expect(output).toContain('await multiply(n, 2)');
    });

    it('should transpile function with multiple params', () => {
      const output = transpile('f:add a b => plus(a, b)');
      expect(output).toContain('async function add(a, b)');
      expect(output).toContain('await plus(a, b)');
    });

    it('should transpile recursive function', () => {
      const output = transpile('rec f:factorial n => multiply(n, factorial(n))');
      expect(output).toContain('async function factorial(n)');
      expect(output).toContain('await factorial(n)');
    });
  });

  describe('structs', () => {
    it('should transpile struct as interface', () => {
      const source = `s:User {
  name: String
  age: Int
}`;
      const output = transpile(source);
      expect(output).toContain('interface User {');
      expect(output).toContain('name: string;');
      expect(output).toContain('age: number;');
    });
  });

  describe('tagged expressions', () => {
    it('should transpile tagged expression producer with identifier tag', () => {
      const output = transpile('f:wrap x => .ok x');
      expect(output).toContain('{ outcome: "ok", value: x }');
    });

    it('should transpile tagged expression producer with string literal tag', () => {
      const output = transpile('f:wrap x => ."just right" x');
      expect(output).toContain('{ outcome: "just right", value: x }');
    });

    it('should transpile outcome match consumer with unwrapped value', () => {
      const output = transpile('process(x)\n| .ok => println');
      expect(output).toContain('__value.outcome === "ok"');
      expect(output).toContain('const __inner = __value.value');
      expect(output).toContain('await println(__inner)');
    });

    it('should transpile outcome match with string literal tag', () => {
      const output = transpile('process(x)\n| ."just right" => println');
      expect(output).toContain('__value.outcome === "just right"');
    });

    it('should transpile outcome match with stream redirect', () => {
      const output = transpile('process(x)\n| .fail => @"errors"');
      expect(output).toContain('__value.outcome === "fail"');
      expect(output).toContain('await __route(__inner, "errors")');
    });
  });

  describe('pipe expressions', () => {
    it('should transpile simple pipe chain with bare names', () => {
      const output = transpile('data |> transform |> validate');
      expect(output).toContain('await validate(await transform(data))');
    });

    it('should transpile pipe with _ placeholder', () => {
      const output = transpile('data |> add(_, 5)');
      expect(output).toContain('await add(data, 5)');
    });

    it('should transpile pipe with _ in non-first position', () => {
      const output = transpile('data |> format("prefix", _)');
      expect(output).toContain('await format("prefix", data)');
    });

    it('should throw when a pipe stage has args but no _ placeholder', () => {
      // Form 3 (standalone) is removed — f(x) in a pipe must use _ or be a bare name
      expect(() => transpile('data |> step1 |> step2()')).toThrow(/placeholder/);
    });

    it('should transpile pipe with stream emit', () => {
      const output = transpile('data |> process @"result"');
      expect(output).toContain('__route');
      expect(output).toContain('"result"');
    });

    it('should transpile pipe in function', () => {
      const output = transpile('f:process data => data |> transform |> validate');
      expect(output).toContain('async function process(data)');
      expect(output).toContain('await validate(await transform(data))');
    });
  });

  describe('parallel expressions', () => {
    it('should transpile parallel composition', () => {
      const output = transpile('fetch(a) PP fetch(b) |> merge');
      expect(output).toContain('Promise.all');
      expect(output).toContain('await merge(await Promise.all');
    });

    it('should transpile parallel with stream emit', () => {
      const output = transpile('fetch(a) PP fetch(b) |> merge @"data"');
      expect(output).toContain('Promise.all');
      expect(output).toContain('__route');
      expect(output).toContain('"data"');
    });
  });

  describe('lambdas', () => {
    it('should transpile lambda', () => {
      const output = transpile('map(nums, |:n| => add(n, 1))');
      expect(output).toContain('async (n) =>');
      expect(output).toContain('await add(n, 1)');
    });

    it('should transpile lambda with multiple params', () => {
      const output = transpile('fold(nums, 0, |:acc, :v| => add(acc, v))');
      expect(output).toContain('async (acc, v) =>');
    });
  });

  describe('on handlers', () => {
    it('should transpile on handler', () => {
      const source = `data |> process @"result"

on @"errors" |> |:e| => log(e)`;
      const output = transpile(source);
      expect(output).toContain('__router.on("errors"');
      expect(output).toContain('async (e) =>');
    });
  });

  describe('route declarations', () => {
    it('should transpile route with single function', () => {
      const source = `op1()\n\nroute @"ok" |> op2`;
      const output = transpile(source);
      expect(output).toContain('__router.on("ok"');
      expect(output).toContain('__routeValue');
      expect(output).toContain('op2');
    });

    it('should transpile route with pipe chain', () => {
      const source = `op1()\n\nroute @"ok" |> op2 |> op3`;
      const output = transpile(source);
      expect(output).toContain('__router.on("ok"');
      expect(output).toContain('op2');
      expect(output).toContain('op3');
    });

    it('should transpile route and on handler together', () => {
      const source = `op1()\n\nroute @"ok" |> process\non @"fail" |> |:x| => rescue(x)`;
      const output = transpile(source);
      expect(output).toContain('__router.on("ok"');
      expect(output).toContain('__router.on("fail"');
    });
  });

  describe('complete programs', () => {
    it('should transpile simple program', () => {
      const source = `f:double n => multiply(n, 2)

double(5)`;
      const output = transpile(source);
      expect(output).toContain('async function double(n)');
      expect(output).toContain('// Main program');
      expect(output).toContain('await double(5)');
    });

    it('should transpile program with outcome matches', () => {
      const source = `f:fetch url =>
  http_get(url) @"ok"
  | .error => @"fail"

fetch("api.com")`;
      const output = transpile(source);
      expect(output).toContain('async function fetch(url)');
      expect(output).toContain('__value.outcome === "error"');
    });

    it('should transpile program with structs and functions', () => {
      const source = `s:User {
  name: String
  age: Int
}

f:create_user name age => User {name: name, age: age}

create_user("Alice", 30)`;
      const output = transpile(source);
      expect(output).toContain('interface User');
      expect(output).toContain('async function create_user');
      expect(output).toContain('await create_user("Alice", 30)');
    });
  });

  describe('imports', () => {
    it('should include runtime import', () => {
      const output = transpile(':x 42');
      expect(output).toContain("import { __router, __route");
      expect(output).toContain("from './stroum-runtime'");
    });
  });
});
