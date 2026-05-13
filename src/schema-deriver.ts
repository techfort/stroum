import * as fs from "fs";
import * as Papa from "papaparse";
import * as path from "path";

export interface FieldDescriptor {
  name: string;
  type: string;
}

export interface SchemaDescriptor {
  name: string;
  fields: FieldDescriptor[];
  source?: string;
}

export interface HeaderlessSchemaDescriptor extends SchemaDescriptor {
  expectedFieldCount: number;
  separator: string;
}

/**
 * Infer the Stroum type for a value
 */
function inferType(value: any): string {
  if (value === null || value === undefined || value === "") {
    return "String"; // Default for empty/null
  }

  const str = String(value).trim();

  // Check for boolean
  if (str === "true" || str === "false") {
    return "Bool";
  }

  // Check for integer
  if (/^-?\d+$/.test(str)) {
    return "Int";
  }

  // Check for float
  if (/^-?\d+\.\d+$/.test(str)) {
    return "Float";
  }

  return "String";
}

/**
 * Infer types for all fields by examining sample rows
 */
function inferFieldTypes(
  rows: any[],
  fieldNames: string[],
): Map<string, string> {
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
    if (counts.size === 0 || (counts.size === 1 && counts.has("String"))) {
      result.set(field, "String");
      continue;
    }

    // Remove String count for type analysis
    const nonStringCounts = new Map(counts);
    nonStringCounts.delete("String");

    if (nonStringCounts.size === 0) {
      result.set(field, "String");
    } else if (nonStringCounts.size === 1) {
      // Single non-string type dominates
      const [[type]] = Array.from(nonStringCounts.entries());
      result.set(field, type);
    } else if (nonStringCounts.has("Float")) {
      // Mixed numeric: Float is more general than Int
      result.set(field, "Float");
    } else if (nonStringCounts.has("Int")) {
      result.set(field, "Int");
    } else {
      // Mixed non-numeric: default to String
      result.set(field, "String");
    }
  }

  return result;
}

function takeSample(rows: any[], limit = 100): any[] {
  return rows.slice(0, Math.min(limit, rows.length));
}

/**
 * Infer schema from CSV file
 */
export function inferFromCsv(
  filePath: string,
  structName: string,
): SchemaDescriptor {
  const content = fs.readFileSync(filePath, "utf-8");
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
    throw new Error("CSV file is empty or has no data rows");
  }

  const fieldNames = Object.keys(rows[0]);
  if (fieldNames.length === 0) {
    throw new Error("CSV file has no columns");
  }

  const fieldTypes = inferFieldTypes(takeSample(rows), fieldNames);

  const fields: FieldDescriptor[] = fieldNames.map((name) => ({
    name,
    type: fieldTypes.get(name) || "String",
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
export function inferFromJson(
  filePath: string,
  structName: string,
): SchemaDescriptor {
  const content = fs.readFileSync(filePath, "utf-8");
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
  } else if (typeof data === "object" && data !== null) {
    rows = [data];
  } else {
    throw new Error("JSON file must contain an object or array of objects");
  }

  if (rows.length === 0) {
    throw new Error("JSON file contains no data");
  }

  // Collect all unique field names across all objects
  const fieldNamesSet = new Set<string>();
  for (const row of rows) {
    if (typeof row === "object" && row !== null) {
      Object.keys(row).forEach((key) => { fieldNamesSet.add(key); });
    }
  }

  const fieldNames = Array.from(fieldNamesSet);
  if (fieldNames.length === 0) {
    throw new Error("JSON objects have no fields");
  }

  const fieldTypes = inferFieldTypes(takeSample(rows), fieldNames);

  const fields: FieldDescriptor[] = fieldNames.map((name) => ({
    name,
    type: fieldTypes.get(name) || "String",
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
  lines.push("}");

  return lines.join("\n");
}

/**
 * Infer schema from file (auto-detect format)
 */
export function inferSchema(
  filePath: string,
  structName: string,
): SchemaDescriptor {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case ".csv":
      return inferFromCsv(filePath, structName);
    case ".json":
      return inferFromJson(filePath, structName);
    default:
      throw new Error(
        `Unsupported file format: ${ext}. Supported: .csv, .json`,
      );
  }
}

/**
 * Infer schema from a headerless delimited file.
 *
 * Uses majority-vote to determine the expected field count, then infers
 * per-column types from rows that match that count.  Rows with a different
 * field count are considered malformed and are excluded from type inference.
 *
 * @param filePath   - path to the file
 * @param structName - desired Stroum struct name
 * @param separator  - field delimiter (e.g. ",")
 * @param fieldNames - optional override for field names (e.g. from LLM);
 *                     if omitted, positional names field_0…field_N are used
 */
export function inferHeaderlessSchema(
  filePath: string,
  structName: string,
  separator: string,
  fieldNames?: string[],
): HeaderlessSchemaDescriptor {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    throw new Error(`File is empty: ${filePath}`);
  }

  // Split every line into fields
  const rows = lines.map((l) => l.split(separator).map((f) => f.trim()));

  // Majority-vote on field count
  const countFreq = new Map<number, number>();
  for (const row of rows) {
    countFreq.set(row.length, (countFreq.get(row.length) ?? 0) + 1);
  }
  let expectedFieldCount = 0;
  let maxFreq = 0;
  for (const [count, freq] of countFreq) {
    // Prefer higher count on ties (more data is better than less)
    if (freq > maxFreq || (freq === maxFreq && count > expectedFieldCount)) {
      maxFreq = freq;
      expectedFieldCount = count;
    }
  }

  // Only use conforming rows for type inference
  const validRows = rows.filter((r) => r.length === expectedFieldCount);

  // Build positional field names if not provided
  const names =
    fieldNames && fieldNames.length === expectedFieldCount
      ? fieldNames
      : Array.from({ length: expectedFieldCount }, (_, i) => `field_${i}`);

  // Convert array rows to objects keyed by field name for inferFieldTypes
  const rowObjects = validRows.map((r) => {
    const obj: Record<string, string> = {};
    names.forEach((n, i) => {
      obj[n] = r[i];
    });
    return obj;
  });

  const fieldTypes = inferFieldTypes(takeSample(rowObjects), names);

  const fields: FieldDescriptor[] = names.map((name) => ({
    name,
    type: fieldTypes.get(name) ?? "String",
  }));

  return {
    name: structName,
    fields,
    source: filePath,
    expectedFieldCount,
    separator,
  };
}

/**
 * Return up to `limit` raw trimmed lines from a headerless file.
 * Used by the AI layer to sample content for field-name inference.
 */
export function sampleLines(filePath: string, limit = 5): string[] {
  const content = fs.readFileSync(filePath, "utf-8");
  return content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, limit);
}
