/**
 * Stroum Preprocessor
 * Handles compile-time directives like #derive for schema injection
 */

import * as fs from "fs";
import * as path from "path";
import { readCachedFieldNames } from "./ai-compiler-assistant";
import {
  inferHeaderlessSchema,
  inferSchema,
  sampleLines,
  schemaToStroumSource,
  type SchemaDescriptor,
} from "./schema-deriver";

export interface PreprocessResult {
  source: string;
  directives: PreprocessDirective[];
}

export interface IngestDirectiveData {
  filePath: string;
  absoluteFilePath: string;
  structName: string;
  separator: string;
  qualifier: string;
  expectedFieldCount: number;
  fields: Array<{ name: string; type: string }>;
  successStream: string;
  failStream: string;
  /** TypeScript boolean expression evaluated after row parsing; field names are in scope as JS vars */
  validateRules?: string;
  /** Stream to route rows that fail validateRules */
  validateFailStream?: string;
}

export type PreprocessDirective =
  | {
      type: "derive";
      line: number;
      original: string;
      replacement: string;
      metadata: { path: string; structName: string; schema: SchemaDescriptor };
    }
  | {
      type: "ingest";
      line: number;
      original: string;
      data: IngestDirectiveData;
    };

/**
 * Preprocess Stroum source code, expanding compile-time directives.
 * Supports:
 *   #derive schema "path/to/file.csv" as StructName
 *   #derive parser StructName "separator" [as funcName] [trim] [nullable]
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

  // #derive schema "path" as Name [si|ai[:provider[/model]]]
  const schemaRegex = /^#derive\s+schema\s+"([^"]+)"\s+as\s+(\w+)(?:\s+(si|ai(?::\w+(?:\/[\w.-]+)?)?))??\s*$/;
  const parserRegex = /^#derive\s+parser\s+(\w+)\s+"([^"]*)"\s*(?:as\s+(\w+))?\s*(.*?)\s*$/;
  // #ingest "file" as Name separator "sep" (si|ai[:provider[/model]]) success @"stream" fail @"stream"
  const ingestRegex =
    /^#ingest\s+"([^"]+)"\s+as\s+(\w+)\s+separator\s+"([^"]*)"\s+(si|ai(?::\w+(?:\/[\w.-]+)?)?)\s+success\s+@"([^"]+)"\s+fail\s+@"([^"]+)"\s*$/;
  // #validate StructName (si rules "expr" | ai[:provider]) fail @"stream"
  const validateRegex =
    /^#validate\s+(\w+)\s+(si)\s+rules\s+"([^"]*)"\s+fail\s+@"([^"]+)"\s*$|^#validate\s+(\w+)\s+(ai(?::\w+(?:\/[\w.-]+)?)?)\s+fail\s+@"([^"]+)"\s*$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const schemaMatch = line.match(schemaRegex);
    const parserMatch = line.match(parserRegex);
    const ingestMatch = line.match(ingestRegex);
    const validateMatch = line.match(validateRegex);

    if (ingestMatch) {
      const [original, filePath, structName, separator, qualifier, successStream, failStream] =
        ingestMatch;
      try {
        let absolutePath = filePath;
        if (sourcePath && !path.isAbsolute(filePath)) {
          absolutePath = path.resolve(path.dirname(sourcePath), filePath);
        }

        // For ai qualifiers, check the cache for AI-generated field names.
        // The cache is warmed by prefetchIngestAINames() in the CLI before module loading.
        let aiFieldNames: string[] | null = null;
        if (qualifier.startsWith("ai") && sourcePath) {
          const rows = sampleLines(absolutePath, 5);
          aiFieldNames = readCachedFieldNames(rows, separator, qualifier, sourcePath);
          if (!aiFieldNames) {
            console.warn(`[stroum] AI field names not yet cached for ${filePath} — using positional names. Run again to use cached AI names.`);
          }
        }

        const schema = inferHeaderlessSchema(
          absolutePath,
          structName,
          separator,
          aiFieldNames ?? undefined,
        );
        const structDef = schemaToStroumSource(schema);

        directives.push({
          type: "ingest",
          line: i + 1,
          original,
          data: {
            filePath,
            absoluteFilePath: absolutePath,
            structName,
            separator,
            qualifier,
            expectedFieldCount: schema.expectedFieldCount,
            fields: schema.fields,
            successStream,
            failStream,
          },
        });

        processedLines.push(`-- Auto-generated from: ${original}`);
        processedLines.push(structDef);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        processedLines.push(`-- ERROR: Failed to process #ingest: ${msg}`);
        processedLines.push(line);
      }
    } else if (schemaMatch) {
      const [original, filePath, structName, qualifier] = schemaMatch;

      try {
        let absolutePath = filePath;
        if (sourcePath && !path.isAbsolute(filePath)) {
          const sourceDir = path.dirname(sourcePath);
          absolutePath = path.resolve(sourceDir, filePath);
        }

        let schema: SchemaDescriptor;

        if (qualifier) {
          // With explicit qualifier: use headerless inference (no header row assumed)
          let aiFieldNames: string[] | null = null;
          if (qualifier.startsWith("ai") && sourcePath) {
            const rows = sampleLines(absolutePath, 5);
            aiFieldNames = readCachedFieldNames(rows, ",", qualifier, sourcePath);
            if (!aiFieldNames) {
              console.warn(`[stroum] AI field names not yet cached for ${filePath} — using positional names.`);
            }
          }
          schema = inferHeaderlessSchema(absolutePath, structName, ",", aiFieldNames ?? undefined);
        } else {
          schema = inferSchema(absolutePath, structName);
        }

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
      const [original, structName, separator, customFuncName, optStr] = parserMatch;
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
          customFuncName || undefined,
        );
        processedLines.push(`-- Auto-generated parser from: ${original}`);
        for (const genLine of generated.split("\n")) {
          processedLines.push(genLine);
        }
      }
    } else if (validateMatch) {
      // si mode: groups 1-4; ai mode: groups 5-7
      const structName = validateMatch[1] ?? validateMatch[5];
      const qualifier = validateMatch[2] ?? validateMatch[6];
      const failStream = validateMatch[4] ?? validateMatch[7];

      let rules: string | null = null;

      if (qualifier === "si") {
        rules = validateMatch[3] ?? null;
      } else if (qualifier.startsWith("ai") && sourcePath) {
        // AI-generated validate rules: look up the validate-rules cache entry
        const ingestDir = directives.find(
          (d) => d.type === "ingest" && d.data.structName === structName,
        );
        if (ingestDir && ingestDir.type === "ingest") {
          const sampleRows = sampleLines(ingestDir.data.absoluteFilePath, 5);
          const cached = readCachedFieldNames(sampleRows, ingestDir.data.separator, qualifier, sourcePath);
          if (cached && cached.length > 0) {
            rules = cached.join(" && ");
          } else {
            console.warn(`[stroum] AI validate rules not yet cached for ${structName} — skipping validation.`);
          }
        }
      }

      if (rules) {
        // Find the matching ingest directive and attach the validation rules
        const ingestDir = directives.find(
          (d) => d.type === "ingest" && d.data.structName === structName,
        );
        if (ingestDir && ingestDir.type === "ingest") {
          ingestDir.data.validateRules = rules;
          ingestDir.data.validateFailStream = failStream;
        } else {
          processedLines.push(
            `-- ERROR: #validate: no #ingest found for struct '${structName}'`,
          );
        }
      }

      processedLines.push(`-- #validate ${structName} applied`);
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
  funcName?: string,
): string {
  const out: string[] = [];
  const name = funcName ?? `parse_${structName.toLowerCase()}`;
  out.push(`f:${name} __line:String -> ${structName} =>`);

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
  return (
    /^#derive\s+(schema|parser)\s+/m.test(source) ||
    /^#ingest\s+/m.test(source) ||
    /^#validate\s+/m.test(source)
  );
}
