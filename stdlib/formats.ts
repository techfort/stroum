// Stroum Standard Library - Data Formats Module
// Runtime functions for schema inference and data file reading

import * as fs from 'fs';
import * as Papa from 'papaparse';
import { inferSchema } from '../schema-deriver';
import { __router } from '../runtime-template';

/**
 * Infer schema from a CSV or JSON file at runtime.
 * Emits schema metadata to the __meta stream for observability.
 * 
 * @param path - Path to the data file
 * @returns Schema information object
 */
export async function infer_schema(path: string): Promise<any> {
  try {
    const schema = inferSchema(path);
    
    // Emit to __meta stream for observability
    await __router.emit('__meta', {
      kind: 'schema',
      name: schema.name,
      fields: schema.fields,
      source: path,
      timestamp: Date.now()
    });
    
    return schema;
  } catch (err: any) {
    throw new Error(`Failed to infer schema from ${path}: ${err.message}`);
  }
}

/**
 * Read a CSV file and parse it into an array of records.
 * Each record is a plain JavaScript object with string keys.
 * 
 * @param path - Path to the CSV file
 * @returns Array of record objects
 */
export async function read_csv(path: string): Promise<any[]> {
  const content = fs.readFileSync(path, 'utf-8');
  
  return new Promise((resolve, reject) => {
    Papa.parse(content, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(`CSV parse error: ${results.errors[0].message}`));
        } else {
          resolve(results.data);
        }
      },
      error: (err) => {
        reject(new Error(`CSV parse error: ${err.message}`));
      }
    });
  });
}

/**
 * Read and parse a JSON file.
 * 
 * @param path - Path to the JSON file
 * @returns Parsed JSON data
 */
export async function read_json(path: string): Promise<any> {
  try {
    const content = fs.readFileSync(path, 'utf-8');
    return JSON.parse(content);
  } catch (err: any) {
    throw new Error(`Failed to read JSON from ${path}: ${err.message}`);
  }
}
