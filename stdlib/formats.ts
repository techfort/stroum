// Stroum Standard Library - Data Formats Module
// Runtime functions for schema inference and data file reading

import * as fs from 'fs';
import * as Papa from 'papaparse';
import { inferSchema } from '../schema-deriver';
import { __router } from '../runtime-template';
import * as parquet from 'parquetjs';
import * as avro from 'avsc';

/**
 * Infer schema from a CSV or JSON file at runtime.
 * Emits schema metadata to the __meta stream for observability.
 * 
 * @param path - Path to the data file
 * @returns Schema information object
 */
export async function infer_schema(path: string): Promise<any> {
  try {
    // Derive struct name from file path
    const fileName = path.split('/').pop() || 'data';
    const structName = fileName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_');
    const schema = inferSchema(path, structName);
    
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
      error: (err: any) => {
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

/**
 * Read a Parquet file and parse it into an array of records.
 * Each record is a plain JavaScript object with fields from the Parquet schema.
 * 
 * @param path - Path to the Parquet file
 * @returns Array of record objects
 */
export async function read_parquet(path: string): Promise<any[]> {
  try {
    const reader = await parquet.ParquetReader.openFile(path);
    const cursor = reader.getCursor();
    const records: any[] = [];
    
    let record = await cursor.next();
    while (record) {
      records.push(record);
      record = await cursor.next();
    }
    
    await reader.close();
    return records;
  } catch (err: any) {
    throw new Error(`Failed to read Parquet from ${path}: ${err.message}`);
  }
}

/**
 * Read an Avro file and parse it into an array of records.
 * Each record is a plain JavaScript object with fields from the Avro schema.
 * 
 * @param path - Path to the Avro file
 * @returns Array of record objects
 */
export async function read_avro(path: string): Promise<any[]> {
  try {
    // Check if file exists before attempting to decode
    if (!fs.existsSync(path)) {
      throw new Error(`File not found: ${path}`);
    }
    
    const type = await avro.createFileDecoder(path);
    const records: any[] = [];
    
    for await (const record of type) {
      records.push(record);
    }
    
    return records;
  } catch (err: any) {
    throw new Error(`Failed to read Avro from ${path}: ${err.message}`);
  }
}
