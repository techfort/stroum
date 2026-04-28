import { Lexer } from './lexer';
import { TokenType } from './types';

describe('Lexer', () => {
  const tokenize = (source: string) => {
    const lexer = new Lexer(source);
    return lexer.tokenize();
  };

  const tokenTypes = (source: string) => {
    return tokenize(source).map(t => t.type);
  };

  const tokenValues = (source: string) => {
    return tokenize(source).map(t => t.value);
  };

  describe('identifiers', () => {
    it('should tokenize lowercase identifiers', () => {
      const tokens = tokenize('foo bar baz_qux');
      expect(tokens.map(t => t.type)).toEqual([
        TokenType.IDENTIFIER,
        TokenType.IDENTIFIER,
        TokenType.IDENTIFIER,
        TokenType.EOF
      ]);
      expect(tokens.map(t => t.value)).toEqual(['foo', 'bar', 'baz_qux', '']);
    });

    it('should reject mixed-case identifiers', () => {
      expect(() => tokenize('myValue')).toThrow(/must be lowercase/);
    });

    it('should tokenize type names', () => {
      const tokens = tokenize('User Payload Email');
      expect(tokens.map(t => t.type)).toEqual([
        TokenType.TYPE_NAME,
        TokenType.TYPE_NAME,
        TokenType.TYPE_NAME,
        TokenType.EOF
      ]);
      expect(tokens.map(t => t.value)).toEqual(['User', 'Payload', 'Email', '']);
    });

    it('should reject invalid type names', () => {
      expect(() => tokenize('USER')).toThrow(/Invalid type name/);
      expect(() => tokenize('User_Name')).toThrow(/Invalid type name/);
    });
  });

  describe('keywords', () => {
    it('should recognize rec keyword', () => {
      expect(tokenTypes('rec')).toEqual([TokenType.REC, TokenType.EOF]);
    });

    it('should recognize on keyword', () => {
      expect(tokenTypes('on')).toEqual([TokenType.ON, TokenType.EOF]);
    });

    it('should recognize boolean literals', () => {
      expect(tokenTypes('true false')).toEqual([
        TokenType.BOOLEAN,
        TokenType.BOOLEAN,
        TokenType.EOF
      ]);
    });
  });

  describe('sigils', () => {
    it('should tokenize b: sigil', () => {
      expect(tokenTypes('b:')).toEqual([TokenType.SIGIL_BINDING, TokenType.EOF]);
    });

    it('should tokenize f: sigil', () => {
      expect(tokenTypes('f:')).toEqual([TokenType.SIGIL_FUNCTION, TokenType.EOF]);
    });

    it('should tokenize s: sigil', () => {
      expect(tokenTypes('s:')).toEqual([TokenType.SIGIL_STRUCT, TokenType.EOF]);
    });

    it('should tokenize : alone', () => {
      expect(tokenTypes(':')).toEqual([TokenType.COLON, TokenType.EOF]);
    });

    it('should not confuse sigils with identifiers', () => {
      const tokens = tokenize('fetch s:User');
      expect(tokens.map(t => t.type)).toEqual([
        TokenType.IDENTIFIER,
        TokenType.SIGIL_STRUCT,
        TokenType.TYPE_NAME,
        TokenType.EOF
      ]);
    });
  });

  describe('operators', () => {
    it('should tokenize pipe operator', () => {
      expect(tokenTypes('|>')).toEqual([TokenType.PIPE, TokenType.EOF]);
    });

    it('should tokenize partial pipe operator', () => {
      expect(tokenTypes('|?>')).toEqual([TokenType.PIPE_PARTIAL, TokenType.EOF]);
    });

    it('should tokenize bar', () => {
      expect(tokenTypes('|')).toEqual([TokenType.BAR, TokenType.EOF]);
    });

    it('should tokenize arrow', () => {
      expect(tokenTypes('=>')).toEqual([TokenType.ARROW, TokenType.EOF]);
    });

    it('should tokenize output arrow', () => {
      expect(tokenTypes('->')).toEqual([TokenType.OUTPUT_ARROW, TokenType.EOF]);
    });

    it('should tokenize PP operator', () => {
      expect(tokenTypes('PP')).toEqual([TokenType.PP, TokenType.EOF]);
    });

    it('should tokenize XX operator', () => {
      expect(tokenTypes('XX')).toEqual([TokenType.XX, TokenType.EOF]);
    });

    it('should tokenize @ operator', () => {
      expect(tokenTypes('@')).toEqual([TokenType.AT, TokenType.EOF]);
    });

    it('should tokenize @> operator', () => {
      expect(tokenTypes('@>')).toEqual([TokenType.AT_REDIRECT, TokenType.EOF]);
    });

    it('should tokenize ~> operator', () => {
      expect(tokenTypes('~>')).toEqual([TokenType.EMIT_CONTRACT, TokenType.EOF]);
    });

    it('should tokenize dot', () => {
      expect(tokenTypes('.')).toEqual([TokenType.DOT, TokenType.EOF]);
    });
  });

  describe('literals', () => {
    it('should tokenize integers', () => {
      const tokens = tokenize('42 0 123');
      expect(tokens.map(t => t.type)).toEqual([
        TokenType.NUMBER,
        TokenType.NUMBER,
        TokenType.NUMBER,
        TokenType.EOF
      ]);
      expect(tokens.map(t => t.value)).toEqual(['42', '0', '123', '']);
    });

    it('should tokenize floats', () => {
      const tokens = tokenize('3.14 0.5 99.99');
      expect(tokens.map(t => t.type)).toEqual([
        TokenType.NUMBER,
        TokenType.NUMBER,
        TokenType.NUMBER,
        TokenType.EOF
      ]);
      expect(tokens.map(t => t.value)).toEqual(['3.14', '0.5', '99.99', '']);
    });

    it('should tokenize strings', () => {
      const tokens = tokenize('"hello" "world"');
      expect(tokens.map(t => t.type)).toEqual([
        TokenType.STRING,
        TokenType.STRING,
        TokenType.EOF
      ]);
      expect(tokens.map(t => t.value)).toEqual(['hello', 'world', '']);
    });

    it('should tokenize empty strings', () => {
      const tokens = tokenize('""');
      expect(tokens.map(t => t.type)).toEqual([TokenType.STRING, TokenType.EOF]);
      expect(tokens[0].value).toBe('');
    });

    it('should handle escaped characters in strings', () => {
      const tokens = tokenize('"hello\\"world"');
      expect(tokens[0].value).toBe('hello"world');
    });

    it('should error on unterminated strings', () => {
      expect(() => tokenize('"hello')).toThrow(/Unterminated string/);
    });

    it('should error on strings with newlines', () => {
      expect(() => tokenize('"hello\nworld"')).toThrow(/Unterminated string/);
    });
  });

  describe('delimiters', () => {
    it('should tokenize parentheses', () => {
      expect(tokenTypes('()')).toEqual([
        TokenType.LPAREN,
        TokenType.RPAREN,
        TokenType.EOF
      ]);
    });

    it('should tokenize braces', () => {
      expect(tokenTypes('{}')).toEqual([
        TokenType.LBRACE,
        TokenType.RBRACE,
        TokenType.EOF
      ]);
    });

    it('should tokenize brackets', () => {
      expect(tokenTypes('[]')).toEqual([
        TokenType.LBRACKET,
        TokenType.RBRACKET,
        TokenType.EOF
      ]);
    });

    it('should tokenize commas', () => {
      expect(tokenTypes(',')).toEqual([TokenType.COMMA, TokenType.EOF]);
    });
  });

  describe('comments', () => {
    it('should skip line comments', () => {
      const tokens = tokenize('foo -- this is a comment\nbar');
      expect(tokens.map(t => t.type)).toEqual([
        TokenType.IDENTIFIER,
        TokenType.IDENTIFIER,
        TokenType.EOF
      ]);
      expect(tokens.map(t => t.value)).toEqual(['foo', 'bar', '']);
    });

    it('should skip comments at start of line', () => {
      const tokens = tokenize('-- comment\nfoo');
      expect(tokens.map(t => t.type)).toEqual([
        TokenType.IDENTIFIER,
        TokenType.EOF
      ]);
    });
  });

  describe('whitespace and indentation', () => {
    it('should skip regular whitespace', () => {
      const tokens = tokenize('foo   bar\t\tbaz');
      expect(tokens.map(t => t.type)).toEqual([
        TokenType.IDENTIFIER,
        TokenType.IDENTIFIER,
        TokenType.IDENTIFIER,
        TokenType.EOF
      ]);
    });

    it('should emit INDENT token', () => {
      const source = 'foo\n  bar';
      const tokens = tokenize(source);
      expect(tokens.map(t => t.type)).toEqual([
        TokenType.IDENTIFIER,
        TokenType.INDENT,
        TokenType.IDENTIFIER,
        TokenType.DEDENT,
        TokenType.EOF
      ]);
    });

    it('should emit DEDENT token', () => {
      const source = 'foo\n  bar\nbaz';
      const tokens = tokenize(source);
      expect(tokens.map(t => t.type)).toEqual([
        TokenType.IDENTIFIER,
        TokenType.INDENT,
        TokenType.IDENTIFIER,
        TokenType.DEDENT,
        TokenType.IDENTIFIER,
        TokenType.EOF
      ]);
    });

    it('should handle multiple indent levels', () => {
      const source = 'a\n  b\n    c\n  d\ne';
      const tokens = tokenize(source);
      expect(tokens.map(t => t.type)).toEqual([
        TokenType.IDENTIFIER,
        TokenType.INDENT,
        TokenType.IDENTIFIER,
        TokenType.INDENT,
        TokenType.IDENTIFIER,
        TokenType.DEDENT,
        TokenType.IDENTIFIER,
        TokenType.DEDENT,
        TokenType.IDENTIFIER,
        TokenType.EOF
      ]);
    });

    it('should emit multiple DEDENT tokens', () => {
      const source = 'a\n  b\n    c\nd';
      const tokens = tokenize(source);
      expect(tokens.map(t => t.type)).toEqual([
        TokenType.IDENTIFIER,
        TokenType.INDENT,
        TokenType.IDENTIFIER,
        TokenType.INDENT,
        TokenType.IDENTIFIER,
        TokenType.DEDENT,
        TokenType.DEDENT,
        TokenType.IDENTIFIER,
        TokenType.EOF
      ]);
    });

    it('should ignore empty lines for indentation', () => {
      const source = 'a\n\nb';
      const tokens = tokenize(source);
      expect(tokens.map(t => t.type)).toEqual([
        TokenType.IDENTIFIER,
        TokenType.IDENTIFIER,
        TokenType.EOF
      ]);
    });
  });

  describe('complex expressions', () => {
    it('should tokenize function declaration', () => {
      const source = 'f:double n => multiply(n, 2)';
      const types = tokenTypes(source);
      expect(types).toEqual([
        TokenType.SIGIL_FUNCTION,
        TokenType.IDENTIFIER,
        TokenType.IDENTIFIER,
        TokenType.ARROW,
        TokenType.IDENTIFIER,
        TokenType.LPAREN,
        TokenType.IDENTIFIER,
        TokenType.COMMA,
        TokenType.NUMBER,
        TokenType.RPAREN,
        TokenType.EOF
      ]);
    });

    it('should tokenize pipe expression', () => {
      const source = 'nums |> filter(|:v| => gt(v, 0))';
      const types = tokenTypes(source);
      expect(types).toContain(TokenType.PIPE);
      expect(types).toContain(TokenType.BAR);
      expect(types).toContain(TokenType.COLON);
    });

    it('should tokenize stream emission', () => {
      const source = 'fetch(url) @"ok"';
      const types = tokenTypes(source);
      expect(types).toEqual([
        TokenType.IDENTIFIER,
        TokenType.LPAREN,
        TokenType.IDENTIFIER,
        TokenType.RPAREN,
        TokenType.AT,
        TokenType.STRING,
        TokenType.EOF
      ]);
    });

    it('should tokenize parallel composition', () => {
      const source = 'fetch(a) PP fetch(b) |> merge';
      const types = tokenTypes(source);
      expect(types).toContain(TokenType.PP);
      expect(types).toContain(TokenType.PIPE);
    });

    it('should tokenize outcome matching', () => {
      const source = 'fetch(url)\n| .fail => log()';
      const types = tokenTypes(source);
      expect(types).toContain(TokenType.BAR);
      expect(types).toContain(TokenType.DOT);
      expect(types).toContain(TokenType.ARROW);
    });

    it('should tokenize stream termination', () => {
      const source = 'final() @"ok"XX';
      const types = tokenTypes(source);
      expect(types).toContain(TokenType.AT);
      expect(types).toContain(TokenType.STRING);
      expect(types).toContain(TokenType.XX);
    });

    it('should tokenize struct declaration', () => {
      const source = 's:User {\n  name: String\n  age: Int\n}';
      const types = tokenTypes(source);
      expect(types).toContain(TokenType.SIGIL_STRUCT);
      expect(types).toContain(TokenType.TYPE_NAME);
      expect(types).toContain(TokenType.LBRACE);
      expect(types).toContain(TokenType.RBRACE);
    });

    it('should tokenize emission contract', () => {
      const source = 'f:fetch url ~> @"ok", @"fail" => http_get(url)';
      const types = tokenTypes(source);
      expect(types).toContain(TokenType.EMIT_CONTRACT);
    });
  });

  describe('error handling', () => {
    it('should report line and column numbers', () => {
      try {
        tokenize('foo\nbar MyValue');
      } catch (e: any) {
        expect(e.message).toMatch(/line 2/);
      }
    });

    it('should reject = without >', () => {
      expect(() => tokenize('a = b')).toThrow(/did you mean/);
    });

    it('should reject ~ without >', () => {
      expect(() => tokenize('a ~ b')).toThrow(/did you mean/);
    });

    it('should reject standalone -', () => {
      expect(() => tokenize('a - b')).toThrow(/Unexpected/);
    });
  });
});
