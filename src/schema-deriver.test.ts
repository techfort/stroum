/**
 * Tests for schema inference functionality
 */

import { inferSchema, schemaToStroumSource } from '../src/schema-deriver';
import * as path from 'path';

describe('Schema Inference', () => {
  const csvPath = path.join(__dirname, '../test-fixtures/sample.csv');
  const jsonPath = path.join(__dirname, '../test-fixtures/sample.json');

  describe('inferSchema from CSV', () => {
    it('should infer correct types from CSV file', () => {
      const schema = inferSchema(csvPath, 'Testrow');
      
      expect(schema.name).toBe('Testrow');
      expect(schema.fields).toHaveLength(6);
      expect(schema.source).toBe(csvPath);
      
      // Check field names
      const fieldNames = schema.fields.map(f => f.name);
      expect(fieldNames).toEqual(['id', 'name', 'email', 'age', 'score', 'active']);
      
      // Check field types
      const fieldTypes = schema.fields.map(f => f.type);
      expect(fieldTypes).toEqual(['Int', 'String', 'String', 'Int', 'Float', 'Bool']);
    });

    it('should handle different data types correctly', () => {
      const schema = inferSchema(csvPath, 'Row');
      const typeMap = new Map(schema.fields.map(f => [f.name, f.type]));
      
      // Integer field
      expect(typeMap.get('id')).toBe('Int');
      expect(typeMap.get('age')).toBe('Int');
      
      // String fields
      expect(typeMap.get('name')).toBe('String');
      expect(typeMap.get('email')).toBe('String');
      
      // Float field
      expect(typeMap.get('score')).toBe('Float');
      
      // Boolean field
      expect(typeMap.get('active')).toBe('Bool');
    });
  });

  describe('inferSchema from JSON', () => {
    it('should infer correct types from JSON file', () => {
      const schema = inferSchema(jsonPath, 'User');
      
      expect(schema.name).toBe('User');
      expect(schema.fields).toHaveLength(5);
      expect(schema.source).toBe(jsonPath);
      
      // Check field names
      const fieldNames = schema.fields.map(f => f.name);
      expect(fieldNames).toContain('userId');
      expect(fieldNames).toContain('username');
      expect(fieldNames).toContain('email');
      expect(fieldNames).toContain('isActive');
      expect(fieldNames).toContain('balance');
      
      // Check field types
      const typeMap = new Map(schema.fields.map(f => [f.name, f.type]));
      expect(typeMap.get('userId')).toBe('Int');
      expect(typeMap.get('username')).toBe('String');
      expect(typeMap.get('email')).toBe('String');
      expect(typeMap.get('isActive')).toBe('Bool');
      expect(typeMap.get('balance')).toBe('Float');
    });
  });

  describe('schemaToStroumSource', () => {
    it('should generate valid Stroum struct definition', () => {
      const schema = inferSchema(csvPath, 'Sample');
      const source = schemaToStroumSource(schema);
      
      // Should start with struct declaration
      expect(source).toMatch(/^s:Sample \{/);
      
      // Should end with closing brace
      expect(source).toMatch(/\}$/);
      
      // Should contain field definitions
      expect(source).toContain('id: Int');
      expect(source).toContain('name: String');
      expect(source).toContain('email: String');
      expect(source).toContain('age: Int');
      expect(source).toContain('score: Float');
      expect(source).toContain('active: Bool');
    });

    it('should properly format struct with indentation', () => {
      const schema = {
        name: 'Test',
        fields: [
          { name: 'x', type: 'Int' },
          { name: 'y', type: 'String' }
        ],
        source: 'test.csv'
      };
      
      const source = schemaToStroumSource(schema);
      const lines = source.split('\n');
      
      expect(lines[0]).toBe('s:Test {');
      expect(lines[1]).toBe('  x: Int');
      expect(lines[2]).toBe('  y: String');
      expect(lines[3]).toBe('}');
    });
  });

  describe('Error handling', () => {
    it('should throw error for non-existent file', () => {
      expect(() => {
        inferSchema('nonexistent.csv', 'Test');
      }).toThrow();
    });

    it('should throw error for unsupported file type', () => {
      expect(() => {
        inferSchema('test.txt', 'Test');
      }).toThrow(/Unsupported file format/);
    });
  });
});
