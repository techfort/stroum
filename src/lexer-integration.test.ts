import { Lexer } from './lexer';
import { TokenType } from './types';
import * as fs from 'fs';
import * as path from 'path';

describe('Lexer - Full Syntax Sketch', () => {
  it('should tokenize the complete syntax sketch without errors', () => {
    const sketchPath = path.join(__dirname, '../test-fixtures/syntax-sketch.stm');
    const source = fs.readFileSync(sketchPath, 'utf-8');
    
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    
    // Should complete without throwing
    expect(tokens).toBeDefined();
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens[tokens.length - 1].type).toBe(TokenType.EOF);
  });

  it('should produce expected token types for key constructs', () => {
    const sketchPath = path.join(__dirname, '../test-fixtures/syntax-sketch.stm');
    const source = fs.readFileSync(sketchPath, 'utf-8');
    
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const types = tokens.map(t => t.type);
    
    // Verify presence of key token types
    expect(types).toContain(TokenType.SIGIL_FUNCTION);
    expect(types).toContain(TokenType.SIGIL_STRUCT);
    expect(types).toContain(TokenType.PIPE);
    expect(types).toContain(TokenType.PIPE_PARTIAL);
    expect(types).toContain(TokenType.PP);
    expect(types).toContain(TokenType.XX);
    expect(types).toContain(TokenType.AT);
    expect(types).toContain(TokenType.AT_REDIRECT);
    expect(types).toContain(TokenType.EMIT_CONTRACT);
    expect(types).toContain(TokenType.REC);
    expect(types).toContain(TokenType.ON);
    expect(types).toContain(TokenType.TYPE_NAME);
    expect(types).toContain(TokenType.INDENT);
    expect(types).toContain(TokenType.DEDENT);
  });

  it('should correctly tokenize function declarations', () => {
    const source = 'f:double n => multiply(n, 2)';
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    
    expect(tokens[0].type).toBe(TokenType.SIGIL_FUNCTION);
    expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
    expect(tokens[1].value).toBe('double');
    expect(tokens[2].type).toBe(TokenType.IDENTIFIER);
    expect(tokens[2].value).toBe('n');
    expect(tokens[3].type).toBe(TokenType.ARROW);
  });

  it('should correctly tokenize struct declarations', () => {
    const source = 's:User {\n  name: String\n}';
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    
    expect(tokens[0].type).toBe(TokenType.SIGIL_STRUCT);
    expect(tokens[1].type).toBe(TokenType.TYPE_NAME);
    expect(tokens[1].value).toBe('User');
  });

  it('should correctly tokenize parallel composition', () => {
    const source = 'fetch(a) PP fetch(b) |> merge';
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    
    const ppIndex = tokens.findIndex(t => t.type === TokenType.PP);
    expect(ppIndex).toBeGreaterThan(-1);
    
    const pipeIndex = tokens.findIndex(t => t.type === TokenType.PIPE);
    expect(pipeIndex).toBeGreaterThan(ppIndex);
  });

  it('should correctly tokenize emission with termination', () => {
    const source = 'final_op() @("ok", "audit")XX';
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const types = tokens.map(t => t.type);
    
    expect(types).toContain(TokenType.AT);
    expect(types).toContain(TokenType.XX);
  });
});
