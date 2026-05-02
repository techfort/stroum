/**
 * Stroum Preprocessor
 * Handles compile-time directives like #derive for schema injection
 */

import * as fs from 'fs';
import * as path from 'path';
import { inferSchema, schemaToStroumSource } from './schema-deriver';

export interface PreprocessResult {
  source: string;
  directives: PreprocessDirective[];
}

export interface PreprocessDirective {
  type: 'derive';
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
 * Currently supports:
 *   #derive schema "path/to/file.csv" as StructName
 */
export function preprocess(source: string, sourcePath?: string): PreprocessResult {
  const lines = source.split('\n');
  const directives: PreprocessDirective[] = [];
  const processedLines: string[] = [];

  const deriveRegex = /^#derive\s+schema\s+"([^"]+)"\s+as\s+(\w+)\s*$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(deriveRegex);

    if (match) {
      const [original, filePath, structName] = match;
      
      try {
        // Resolve file path relative to source file if provided
        let absolutePath = filePath;
        if (sourcePath && !path.isAbsolute(filePath)) {
          const sourceDir = path.dirname(sourcePath);
          absolutePath = path.resolve(sourceDir, filePath);
        }

        // Infer schema from the file
        const schema = inferSchema(absolutePath, structName);
        const structDef = schemaToStroumSource(schema);

        // Record the directive
        directives.push({
          type: 'derive',
          line: i + 1,
          original,
          replacement: structDef,
          metadata: {
            path: filePath,
            structName,
            schema
          }
        });

        // Replace the directive with the struct definition
        processedLines.push(`-- Auto-generated from: ${original}`);
        processedLines.push(structDef);
      } catch (err: any) {
        // On error, preserve the directive and add an error comment
        processedLines.push(`-- ERROR: Failed to process #derive: ${err.message}`);
        processedLines.push(line);
      }
    } else {
      // Keep line as-is
      processedLines.push(line);
    }
  }

  return {
    source: processedLines.join('\n'),
    directives
  };
}

/**
 * Check if source code contains any preprocessor directives
 */
export function hasDirectives(source: string): boolean {
  return /^#derive\s+schema\s+/m.test(source);
}
