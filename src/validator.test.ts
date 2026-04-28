import { Lexer } from './lexer';
import { Parser } from './parser';
import { Validator } from './validator';

function validate(source: string) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const validator = new Validator();
  return validator.validate(ast);
}

describe('Validator', () => {
  describe('duplicate bindings', () => {
    it('should error on duplicate function names', () => {
      const issues = validate('f:foo => 1\nf:foo => 2');
      const errors = issues.filter(i => i.type === 'error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('Duplicate binding');
    });

    it('should error on duplicate binding names', () => {
      const issues = validate(':x 10\n:x 20');
      const errors = issues.filter(i => i.type === 'error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('Duplicate binding');
    });

    it('should error on duplicate function parameters', () => {
      const issues = validate('f:foo x x => add(x, x)');
      const errors = issues.filter(i => i.type === 'error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('Duplicate parameter');
    });

    it('should error on duplicate struct fields', () => {
      const source = `s:User {
  name: String
  name: String
}`;
      const issues = validate(source);
      const errors = issues.filter(i => i.type === 'error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('Duplicate field');
    });

    it('should allow same name in different scopes', () => {
      const issues = validate('f:foo x => |:x| => x');
      const errors = issues.filter(i => i.type === 'error');
      expect(errors.length).toBe(0);
    });
  });

  describe('rec validation', () => {
    it('should warn when rec is used without self-reference', () => {
      const issues = validate('rec f:foo n => add(n, 1)');
      const warnings = issues.filter(i => i.type === 'warning');
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].message).toContain('does not reference itself');
    });

    it('should not warn when rec is used with self-reference', () => {
      const issues = validate('rec f:factorial n => multiply(n, factorial(n))');
      const warnings = issues.filter(i => i.type === 'warning' && i.message.includes('does not reference itself'));
      expect(warnings.length).toBe(0);
    });

    it('should detect self-reference in pipe chains', () => {
      const issues = validate('rec f:process data => data |> transform |> process');
      const warnings = issues.filter(i => i.type === 'warning' && i.message.includes('does not reference itself'));
      expect(warnings.length).toBe(0);
    });
  });

  describe('emission contract validation', () => {
    it('should warn when multiple outcomes without contract', () => {
      const source = `f:fetch url =>
  http_get(url) @"ok"
  | .error => @"fail"`;
      const issues = validate(source);
      const warnings = issues.filter(i => i.type === 'warning');
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].message).toContain('outcome paths');
      expect(warnings[0].message).toContain('no emission contract');
    });

    it('should not warn when emission contract is declared', () => {
      const source = `f:fetch url ~> @"ok", @"fail" =>
  http_get(url) @"ok"
  | .error => @"fail"`;
      const issues = validate(source);
      const warnings = issues.filter(i => i.type === 'warning' && i.message.includes('outcome paths'));
      expect(warnings.length).toBe(0);
    });

    it('should not warn for single outcome', () => {
      const issues = validate('f:double n => multiply(n, 2) @"result"');
      const warnings = issues.filter(i => i.type === 'warning' && i.message.includes('outcome paths'));
      expect(warnings.length).toBe(0);
    });
  });

  describe('stream declaration validation', () => {
    it('should error on invalid stream names in contract', () => {
      const issues = validate('f:foo ~> @"123invalid", @"ok" => result @"ok"');
      const errors = issues.filter(i => i.type === 'error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('string literal');
    });

    it('should accept valid stream names', () => {
      const issues = validate('f:foo ~> @"ok", @"error" => result @"ok"');
      const errors = issues.filter(i => i.type === 'error' && i.message.includes('string literal'));
      expect(errors.length).toBe(0);
    });
  });

  describe('complex validation', () => {
    it('should validate complete program with no errors', () => {
      const source = `-- Define helper functions used in this test
f:json_parse raw => raw
f:normalise data => data
f:validate data => data
f:merge a => a
f:fetch url => url
f:log msg => msg

-- Define bindings used in expressions
:primary "url1"
:secondary "url2"

f:parse raw ~> @"ok", @"fail" =>
  json_parse(raw) @"ok"
  | .fail => @"fail"

f:transform data ~> @"clean", @"rejected" =>
  data |> normalise |> validate @"clean"
  | .invalid => @"rejected"

fetch(primary) PP fetch(secondary) |> merge @"data"

on @"errors" |> |:e| => log(e)`;
      
      const issues = validate(source);
      const errors = issues.filter(i => i.type === 'error');
      expect(errors.length).toBe(0);
    });

    it('should catch multiple issues in one program', () => {
      const source = `f:foo => 1
f:foo => 2
rec f:bar x => add(x, 1)
f:baz y =>
  result @"ok"
  | .error => @"fail"`;
      
      const issues = validate(source);
      const errors = issues.filter(i => i.type === 'error');
      const warnings = issues.filter(i => i.type === 'warning');
      
      expect(errors.length).toBeGreaterThan(0); // Duplicate function
      expect(warnings.length).toBeGreaterThan(0); // rec without self-ref, multiple outcomes
    });
  });

  describe('scope handling', () => {
    it('should track function parameter scope', () => {
      const issues = validate('f:apply fn x => fn(x)');
      const errors = issues.filter(i => i.type === 'error');
      expect(errors.length).toBe(0);
    });

    it('should track lambda parameter scope', () => {
      const issues = validate(':nums [1, 2, 3]\nmap(nums, |:n| => add(n, 1))');
      const errors = issues.filter(i => i.type === 'error');
      expect(errors.length).toBe(0);
    });

    it('should handle nested lambdas', () => {
      const issues = validate('f:curry fn => |:x| => |:y| => fn(x, y)');
      const errors = issues.filter(i => i.type === 'error');
      expect(errors.length).toBe(0);
    });
  });
});
