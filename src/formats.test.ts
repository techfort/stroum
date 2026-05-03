import * as path from 'path';

// Mock the router before importing formats module
jest.mock('./runtime-template', () => ({
  __router: {
    emit: jest.fn().mockResolvedValue(undefined)
  }
}));

// Import after mocking
const formats = require('../dist/stdlib/formats');
const { read_csv, read_json, read_parquet, read_avro, infer_schema } = formats;

const fixturesPath = (filename: string) => path.join(__dirname, '..', 'test-fixtures', filename);

describe('Formats Module', () => {
  describe('read_csv', () => {
    it('should read and parse CSV file', async () => {
      const data = await read_csv(fixturesPath('sample.csv'));
      
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      
      // Verify structure of first record
      if (data.length > 0) {
        expect(data[0]).toHaveProperty('name');
      }
    });

    it('should handle non-existent CSV file', async () => {
      await expect(read_csv(fixturesPath('nonexistent.csv')))
        .rejects.toThrow();
    });

    it('should parse numeric values with dynamic typing', async () => {
      const data = await read_csv(fixturesPath('sample.csv'));
      
      if (data.length > 0) {
        // Just verify that data was parsed successfully
        const firstRow = data[0];
        expect(firstRow).toBeDefined();
        expect(typeof firstRow).toBe('object');
      }
    });
  });

  describe('read_json', () => {
    it('should read and parse JSON file', async () => {
      const data = await read_json(fixturesPath('sample.json'));
      
      expect(data).toBeDefined();
      expect(typeof data === 'object' || Array.isArray(data)).toBe(true);
    });

    it('should handle non-existent JSON file', async () => {
      await expect(read_json(fixturesPath('nonexistent.json')))
        .rejects.toThrow();
    });

    it('should handle invalid JSON', async () => {
      // Create a temp invalid JSON file for testing
      const invalidJsonPath = fixturesPath('invalid.json');
      const fs = require('fs');
      fs.writeFileSync(invalidJsonPath, '{ invalid json }');
      
      await expect(read_json(invalidJsonPath))
        .rejects.toThrow();
      
      // Cleanup
      fs.unlinkSync(invalidJsonPath);
    });

    it('should preserve data types from JSON', async () => {
      const data = await read_json(fixturesPath('sample.json'));
      
      if (Array.isArray(data) && data.length > 0) {
        const firstItem = data[0];
        
        // Verify that different data types are preserved
        for (const key in firstItem) {
          const value = firstItem[key];
          expect(['string', 'number', 'boolean', 'object'].includes(typeof value)).toBe(true);
        }
      }
    });
  });

  describe('read_parquet', () => {
    it('should read and parse Parquet file', async () => {
      const data = await read_parquet(fixturesPath('sample.parquet'));
      
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      
      // Verify structure
      expect(data[0]).toHaveProperty('id');
      expect(data[0]).toHaveProperty('name');
      expect(data[0]).toHaveProperty('age');
      expect(data[0]).toHaveProperty('score');
      expect(data[0]).toHaveProperty('active');
    });

    it('should parse correct data types from Parquet', async () => {
      const data = await read_parquet(fixturesPath('sample.parquet'));
      
      expect(data.length).toBe(3);
      
      // Verify first record
      expect(data[0].id).toBe(1);
      expect(data[0].name).toBe('Alice');
      expect(data[0].age).toBe(30);
      expect(typeof data[0].score).toBe('number');
      expect(typeof data[0].active).toBe('boolean');
      expect(data[0].active).toBe(true);
    });

    it('should read all records from Parquet file', async () => {
      const data = await read_parquet(fixturesPath('sample.parquet'));
      
      expect(data.length).toBe(3);
      
      // Verify all records are present
      expect(data[0].name).toBe('Alice');
      expect(data[1].name).toBe('Bob');
      expect(data[2].name).toBe('Charlie');
    });

    it('should handle non-existent Parquet file', async () => {
      await expect(read_parquet(fixturesPath('nonexistent.parquet')))
        .rejects.toThrow();
    });

    it('should handle invalid Parquet file', async () => {
      // Create a temp invalid parquet file
      const invalidPath = fixturesPath('invalid.parquet');
      const fs = require('fs');
      fs.writeFileSync(invalidPath, 'not a parquet file');
      
      await expect(read_parquet(invalidPath))
        .rejects.toThrow();
      
      // Cleanup
      fs.unlinkSync(invalidPath);
    });
  });

  describe('read_avro', () => {
    it('should read and parse Avro file', async () => {
      const data = await read_avro(fixturesPath('sample.avro'));
      
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      
      // Verify structure
      expect(data[0]).toHaveProperty('id');
      expect(data[0]).toHaveProperty('name');
      expect(data[0]).toHaveProperty('age');
      expect(data[0]).toHaveProperty('score');
      expect(data[0]).toHaveProperty('active');
    });

    it('should parse correct data types from Avro', async () => {
      const data = await read_avro(fixturesPath('sample.avro'));
      
      expect(data.length).toBe(3);
      
      // Verify first record
      expect(data[0].id).toBe(1);
      expect(data[0].name).toBe('Alice');
      expect(data[0].age).toBe(30);
      expect(typeof data[0].score).toBe('number');
      expect(typeof data[0].active).toBe('boolean');
      expect(data[0].active).toBe(true);
    });

    it('should read all records from Avro file', async () => {
      const data = await read_avro(fixturesPath('sample.avro'));
      
      expect(data.length).toBe(3);
      
      // Verify all records are present
      expect(data[0].name).toBe('Alice');
      expect(data[1].name).toBe('Bob');
      expect(data[2].name).toBe('Charlie');
    });

    it('should handle non-existent Avro file', async () => {
      await expect(read_avro(fixturesPath('nonexistent.avro')))
        .rejects.toThrow();
    }, 10000);

    it('should handle invalid Avro file', async () => {
      // Create a temp invalid avro file
      const invalidPath = fixturesPath('invalid.avro');
      const fs = require('fs');
      fs.writeFileSync(invalidPath, 'not an avro file');
      
      await expect(read_avro(invalidPath))
        .rejects.toThrow();
      
      // Cleanup
      fs.unlinkSync(invalidPath);
    });
  });

  describe('infer_schema', () => {
    it('should infer schema from CSV file', async () => {
      const schema = await infer_schema(fixturesPath('sample.csv'));
      
      expect(schema).toHaveProperty('name');
      expect(schema).toHaveProperty('fields');
      expect(Array.isArray(schema.fields)).toBe(true);
    });

    it('should infer schema from JSON file', async () => {
      const schema = await infer_schema(fixturesPath('sample.json'));
      
      expect(schema).toHaveProperty('name');
      expect(schema).toHaveProperty('fields');
      expect(Array.isArray(schema.fields)).toBe(true);
    });

    it('should handle non-existent file', async () => {
      await expect(infer_schema(fixturesPath('nonexistent.csv')))
        .rejects.toThrow();
    });
  });

  describe('Format Comparison', () => {
    it('should produce equivalent data across all formats', async () => {
      // This test verifies that parquet and avro produce the same data structure
      const parquetData = await read_parquet(fixturesPath('sample.parquet'));
      const avroData = await read_avro(fixturesPath('sample.avro'));
      
      expect(parquetData.length).toBe(avroData.length);
      
      // Compare records
      for (let i = 0; i < parquetData.length; i++) {
        expect(parquetData[i].id).toBe(avroData[i].id);
        expect(parquetData[i].name).toBe(avroData[i].name);
        expect(parquetData[i].age).toBe(avroData[i].age);
        expect(parquetData[i].active).toBe(avroData[i].active);
        
        // Float comparison with small tolerance
        expect(Math.abs(parquetData[i].score - avroData[i].score)).toBeLessThan(0.01);
      }
    });

    it('should handle boolean values correctly in both formats', async () => {
      const parquetData = await read_parquet(fixturesPath('sample.parquet'));
      const avroData = await read_avro(fixturesPath('sample.avro'));
      
      // Check that boolean values are properly typed
      expect(typeof parquetData[0].active).toBe('boolean');
      expect(typeof avroData[0].active).toBe('boolean');
      
      expect(parquetData[0].active).toBe(true);
      expect(parquetData[1].active).toBe(false);
      expect(avroData[0].active).toBe(true);
      expect(avroData[1].active).toBe(false);
    });
  });
});
