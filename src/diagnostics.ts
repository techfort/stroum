import type { SourceLocation } from "./types";

export type DiagnosticStage = "lex" | "parse" | "validate";
export type DiagnosticSeverity = "error" | "warning";

export interface CompileDiagnostic {
  stage: DiagnosticStage;
  severity: DiagnosticSeverity;
  message: string;
  line: number;
  column: number;
  filePath?: string;
}

export class ParseError extends Error {
  readonly line: number;
  readonly column: number;

  constructor(message: string, line: number, column: number) {
    super(message);
    this.name = "ParseError";
    this.line = line;
    this.column = column;
  }
}

export function diagnosticFromLocation(
  stage: DiagnosticStage,
  severity: DiagnosticSeverity,
  message: string,
  loc: SourceLocation,
  filePath?: string,
): CompileDiagnostic {
  return { stage, severity, message, line: loc.line, column: loc.column, filePath };
}
