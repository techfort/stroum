import * as fs from 'fs';
import * as path from 'path';
import * as Papa from 'papaparse';

export interface FieldDescriptor {
  name: string;
  type: string;
}

export interface SchemaDescriptor {
  name: string;
  fields: FieldDescriptor[];
  source?: string;
}

/**
 * Infer the Stroum type for a value
 */
function inferType(value: any): string {
  if (value === null || value === undefined || value === '') {
    return 'String'; // Default for empty/null
  }

  const str = String(value).trim();
  
  // Check for boolean
  if (str === 'true' || str === 'false') {
    return 'Bool';
  }

  // Check for integer
  if (/^-?\d+$/.test(str)) {
    return 'Int';
  }

  // Check for float
  if (/^-?\d+\.\d+$/.test(str)) {
    return 'Float';
  }

  return 'String';
}

/**
 * Infer types for all fields by examining sample rows
 */
function inferFieldTypes(rows: any[], fieldNames: string[]): Map<string, string> {
  const typeCounts = new Map<string, Map<string, number>>();

  // Initialize counts for each field
  for (const field of fieldNames) {
    typeCounts.set(field, new Map());
  }

  // Examine each row
  for (const row of rows) {
    for (const field of fieldNames) {
      const value = row[field];
      const type = inferType(value);
      const counts = typeCounts.get(field)!;
      counts.set(type, (counts.get(type) || 0) + 1);
    }
  }

  // For each field, pick the most specific type that covers all non-String values
  const result = new Map<string, string>();
  for (const field of fieldNames) {
    const counts = typeCounts.get(field)!;
    
    // If only String or mixed, use String
    if (counts.size === 0 || (counts.size === 1 && counts.has('String'))) {
      result.set(field, 'String');
      continue;
    }

    // Remove String count for type analysis
    const nonStringCounts = new Map(counts);
    nonStringCounts.delete('String');

    if (nonStringCounts.size === 0) {
      result.set(field, 'String');
    } else if (nonStringCounts.size === 1) {
      // Single non-string type dominates
      const [[type]] = Array.from(nonStringCounts.entries());
      result.set(field, type);
    } else if (nonStringCounts.has('Float')) {
      // Mixed numeric: Float is more general than Int
      result.set(field, 'Float');
    } else if (nonStringCounts.has('Int')) {
      result.set(field, 'Int');
    } else {
      // Mixed non-numeric: default to String
      result.set(field, 'String');
    }
  }

  return result;
}

/**
 * Infer schema from CSV file
 */
export function inferFromCsv(filePath: string, structName: string): SchemaDescriptor {
  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false, // Keep everything as strings for our own type inference
  });

  if (parsed.errors.length > 0) {
    throw new Error(`CSV parsing failed: ${parsed.errors[0].message}`);
  }

  const rows = parsed.data as any[];
  if (rows.length === 0) {
    throw new Error('CSV file is empty or has no data rows');
  }

  const fieldNames = Object.keys(rows[0]);
  if (fieldNames.length === 0) {
    throw new Error('CSV file has no columns');
  }

  // Sample first 100 rows for type inference
  const sampleSize = Math.min(100, rows.length);
  const sample = rows.slice(0, sampleSize);
  
  const fieldTypes = inferFieldTypes(sample, fieldNames);
  
  const fields: FieldDescriptor[] = fieldNames.map(name => ({
    name,
    type: fieldTypes.get(name) || 'String',
  }));

  return {
    name: structName,
    fields,
    source: filePath,
  };
}

/**
 * Infer schema from JSON file (array of objects or single object)
 */
export function inferFromJson(filePath: string, structName: string): SchemaDescriptor {
  const content = fs.readFileSync(filePath, 'utf-8');
  let data: any;

  try {
    data = JSON.parse(content);
  } catch (err: any) {
    throw new Error(`JSON parsing failed: ${err.message}`);
  }

  // Convert to array of objects if needed
  let rows: any[];
  if (Array.isArray(data)) {
    rows = data;
  } else if (typeof data === 'object' && data !== null) {
    rows = [data];
  } else {
    throw new Error('JSON file must contain an object or array of objects');
  }

  if (rows.length === 0) {
    throw new Error('JSON file contains no data');
  }

  // Collect all unique field names across all objects
  const fieldNamesSet = new Set<string>();
  for (const row of rows) {
    if (typeof row === 'object' && row !== null) {
      Object.keys(row).forEach(key => fieldNamesSet.add(key));
    }
  }

  const fieldNames = Array.from(fieldNamesSet);
  if (fieldNames.length === 0) {
    throw new Error('JSON objects have no fields');
  }

  // Sample first 100 rows for type inference
  const sampleSize = Math.min(100, rows.length);
  const sample = rows.slice(0, sampleSize);

  const fieldTypes = inferFieldTypes(sample, fieldNames);

  const fields: FieldDescriptor[] = fieldNames.map(name => ({
    name,
    type: fieldTypes.get(name) || 'String',
  }));

  return {
    name: structName,
    fields,
    source: filePath,
  };
}

/**
 * Generate Stroum struct source code from schema descriptor
 */
export function schemaToStroumSource(schema: SchemaDescriptor): string {
  const lines: string[] = [];
  
  lines.push(`s:${schema.name} {`);
  for (const field of schema.fields) {
    lines.push(`  ${field.name}: ${field.type}`);
  }
  lines.push('}');

  return lines.join('\n');
}

/**
 * Infer schema from file (auto-detect format)
 */
export function inferSchema(filePath: string, structName: string): SchemaDescriptor {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case '.csv':
      return inferFromCsv(filePath, structName);
    case '.json':
      return inferFromJson(filePath, structName);
    default:
      throw new Error(`Unsupported file format: ${ext}. Supported: .csv, .json`);
  }
}
