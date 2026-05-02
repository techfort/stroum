/**
 * Tests for preprocessor functionality
 */

import { preprocess, hasDirectives } from '../src/preprocessor';
import * as path from 'path';

describe('Preprocessor', () => {
  const csvPath = path.resolve(__dirname, '../test-fixtures/sample.csv');

  describe('hasDirectives', () => {
    it('should detect #derive directives', () => {
      const source = `-- Test
#derive schema "data.csv" as Row

f:main => println("hi")`;
      
      expect(hasDirectives(source)).toBe(true);
    });

    it('should return false for source without directives', () => {
      const source = `-- Test
f:main => println("hi")`;
      
      expect(hasDirectives(source)).toBe(false);
    });

    it('should detect directives in middle of file', () => {
      const source = `f:test => 42

#derive schema "data.csv" as Row

f:main => println("hi")`;
      
      expect(hasDirectives(source)).toBe(true);
    });
  });

  describe('preprocess', () => {
    it('should expand #derive directive with valid CSV file', () => {
      const source = `-- Test
#derive schema "../test-fixtures/sample.csv" as Row

f:main => println("hi")`;
      
      const sourcePath = path.join(__dirname, '../examples/test.stm');
      const result = preprocess(source, sourcePath);
      
      // Should replace directive with comment and struct
      expect(result.source).toContain('-- Auto-generated from:');
      expect(result.source).toContain('s:Row {');
      expect(result.source).toContain('id: Int');
      expect(result.source).toContain('name: String');
      expect(result.source).toContain('}');
      
      // Should track the directive
      expect(result.directives).toHaveLength(1);
      expect(result.directives[0].type).toBe('derive');
      expect(result.directives[0].line).toBe(2);
      expect(result.directives[0].metadata.structName).toBe('Row');
    });

    it('should handle multiple directives', () => {
      const source = `#derive schema "../test-fixtures/sample.csv" as Row
#derive schema "../test-fixtures/sample.json" as User

f:main => println("hi")`;
      
      const sourcePath = path.join(__dirname, '../examples/test.stm');
      const result = preprocess(source, sourcePath);
      
      expect(result.directives).toHaveLength(2);
      expect(result.directives[0].metadata.structName).toBe('Row');
      expect(result.directives[1].metadata.structName).toBe('User');
      
      // Should contain both struct definitions
      expect(result.source).toContain('s:Row {');
      expect(result.source).toContain('s:User {');
    });

    it('should preserve non-directive lines', () => {
      const source = `-- Comment before
#derive schema "../test-fixtures/sample.csv" as Row
-- Comment after

f:main => println("hi")`;
      
      const sourcePath = path.join(__dirname, '../examples/test.stm');
      const result = preprocess(source, sourcePath);
      
      expect(result.source).toContain('-- Comment before');
      expect(result.source).toContain('-- Comment after');
      expect(result.source).toContain('f:main => println("hi")');
    });

    it('should handle directive with absolute path', () => {
      const source = `#derive schema "${csvPath}" as Row`;
      
      const result = preprocess(source);
      
      expect(result.directives).toHaveLength(1);
      expect(result.source).toContain('s:Row {');
    });

    it('should handle error for non-existent file gracefully', () => {
      const source = `#derive schema "nonexistent.csv" as Row`;
      
      const result = preprocess(source);
      
      // Should add error comment and preserve directive
      expect(result.source).toContain('-- ERROR:');
      expect(result.source).toContain('#derive');
      expect(result.directives).toHaveLength(0);
    });

    it('should not modify source without directives', () => {
      const source = `-- Test
f:main => println("hi")`;
      
      const result = preprocess(source);
      
      expect(result.source).toBe(source);
      expect(result.directives).toHaveLength(0);
    });
  });
});
