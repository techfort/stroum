/**
 * Stroum Preprocessor
 * Handles compile-time directives like #derive for schema injection
 */

import * as fs from "fs";
import * as path from "path";
import { inferSchema, schemaToStroumSource } from "./schema-deriver";

export interface PreprocessResult {
  source: string;
  directives: PreprocessDirective[];
}

export interface PreprocessDirective {
  type: "derive";
  line: number;
  original: string;
  replacement: string;
  metadata: {
    path: string;
    structName: string;
    schema: any;
  };
}

/**
 * Preprocess Stroum source code, expanding compile-time directives.
 * Supports:
 *   #derive schema "path/to/file.csv" as StructName
 *   #derive parser StructName "separator" [trim] [nullable]
 *
 * #derive parser must appear after the struct definition in the file.
 */
export function preprocess(
  source: string,
  sourcePath?: string,
): PreprocessResult {
  const lines = source.split("\n");
  const directives: PreprocessDirective[] = [];
  const processedLines: string[] = [];

  const schemaRegex = /^#derive\s+schema\s+"([^"]+)"\s+as\s+(\w+)\s*$/;
  const parserRegex = /^#derive\s+parser\s+(\w+)\s+"([^"]*)"\s*(.*?)\s*$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const schemaMatch = line.match(schemaRegex);
    const parserMatch = line.match(parserRegex);

    if (schemaMatch) {
      const [original, filePath, structName] = schemaMatch;

      try {
        let absolutePath = filePath;
        if (sourcePath && !path.isAbsolute(filePath)) {
          const sourceDir = path.dirname(sourcePath);
          absolutePath = path.resolve(sourceDir, filePath);
        }

        const schema = inferSchema(absolutePath, structName);
        const structDef = schemaToStroumSource(schema);

        directives.push({
          type: "derive",
          line: i + 1,
          original,
          replacement: structDef,
          metadata: { path: filePath, structName, schema },
        });

        processedLines.push(`-- Auto-generated from: ${original}`);
        processedLines.push(structDef);
      } catch (err: any) {
        processedLines.push(
          `-- ERROR: Failed to process #derive: ${err.message}`,
        );
        processedLines.push(line);
      }
    } else if (parserMatch) {
      const [original, structName, separator, optStr] = parserMatch;
      const opts = optStr.split(/\s+/).filter(Boolean);
      const doTrim = opts.includes("trim");
      const doNullable = opts.includes("nullable");

      const fields = findStructFields(processedLines, structName);

      if (fields.length === 0) {
        processedLines.push(
          `-- ERROR: #derive parser: struct '${structName}' not found above this directive`,
        );
        processedLines.push(line);
      } else {
        const generated = generateParser(
          structName,
          separator,
          fields,
          doTrim,
          doNullable,
        );
        processedLines.push(`-- Auto-generated parser from: ${original}`);
        for (const genLine of generated.split("\n")) {
          processedLines.push(genLine);
        }
      }
    } else {
      processedLines.push(line);
    }
  }

  return {
    source: processedLines.join("\n"),
    directives,
  };
}

function findStructFields(
  lines: string[],
  structName: string,
): Array<{ name: string; type: string }> {
  const fields: Array<{ name: string; type: string }> = [];
  let inStruct = false;
  const structStart = new RegExp(`^\\s*s:${structName}\\s*\\{`);
  const fieldRegex = /^\s+(\w+):\s*(\w+)\s*$/;

  for (const line of lines) {
    if (!inStruct) {
      if (structStart.test(line)) inStruct = true;
    } else {
      if (/^\s*\}/.test(line)) break;
      const m = line.match(fieldRegex);
      if (m) fields.push({ name: m[1], type: m[2] });
    }
  }
  return fields;
}

function applyTypeCast(type: string, expr: string): string {
  if (type === "Int") return `to_int(${expr})`;
  if (type === "Float") return `to_float(${expr})`;
  return expr;
}

function fieldAccessor(index: number): string {
  return index === 0 ? "head(__fields)" : `head(drop(${index}, __fields))`;
}

function generateParser(
  structName: string,
  separator: string,
  fields: Array<{ name: string; type: string }>,
  doTrim: boolean,
  doNullable: boolean,
): string {
  const out: string[] = [];
  out.push(`f:parse_${structName.toLowerCase()} __line =>`);

  const splitExpr = doTrim
    ? `map(trim, split(__line, "${separator}"))`
    : `split(__line, "${separator}")`;
  out.push(`  :__fields ${splitExpr}`);

  // Bind temp vars per field when nullable (needed for the null guard expression)
  if (doNullable) {
    for (let i = 0; i < fields.length; i++) {
      out.push(`  :__f${i} ${fieldAccessor(i)}`);
    }
  }

  const fieldExprs = fields.map((field, i) => {
    if (doNullable) {
      const cast = applyTypeCast(field.type, `__f${i}`);
      const guard =
        cast === `__f${i}`
          ? `if eq(__f${i}, "") then null else __f${i}`
          : `if eq(__f${i}, "") then null else ${cast}`;
      return `${field.name}: ${guard}`;
    }
    return `${field.name}: ${applyTypeCast(field.type, fieldAccessor(i))}`;
  });

  out.push(`  ${structName} { ${fieldExprs.join(", ")} }`);
  return out.join("\n");
}

/**
 * Check if source code contains any preprocessor directives
 */
export function hasDirectives(source: string): boolean {
  return /^#derive\s+(schema|parser)\s+/m.test(source);
}
