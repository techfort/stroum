#!/usr/bin/env node

/**
 * Stroum Language Server (Phase 1 — Diagnostics)
 *
 * Implements the Language Server Protocol over stdio.
 * On every document open/change/save it runs the full
 * Stroum compiler pipeline (preprocessor → lexer → parser → validator)
 * and publishes diagnostics to the client.
 */

import * as path from "path";
import {
  createConnection,
  type Diagnostic,
  DiagnosticSeverity,
  DidChangeConfigurationNotification,
  type InitializeParams,
  type InitializeResult,
  ProposedFeatures,
  TextDocumentSyncKind,
  TextDocuments,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { analyzeDataflow } from "./dataflow-analyzer";
import { Lexer } from "./lexer";
import { Parser } from "./parser";
import { hasDirectives, preprocess } from "./preprocessor";
import { type ValidationIssue, Validator } from "./validator";

// ─── Connection ─────────────────────────────────────────────────────────────

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

let hasConfigCapability = false;
let hasWorkspaceFolderCapability = false;

connection.onInitialize((params: InitializeParams): InitializeResult => {
  const caps = params.capabilities;
  hasConfigCapability = !!(caps.workspace && caps.workspace.configuration);
  hasWorkspaceFolderCapability = !!(
    caps.workspace && caps.workspace.workspaceFolders
  );

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
    },
  };
});

connection.onInitialized(() => {
  if (hasConfigCapability) {
    connection.client.register(
      DidChangeConfigurationNotification.type,
      undefined,
    );
  }
});

// ─── Diagnostics ────────────────────────────────────────────────────────────

function validateDocument(doc: TextDocument): void {
  const uri = doc.uri;
  const filePath = uriToPath(uri);
  const source = doc.getText();
  const diagnostics: Diagnostic[] = [];

  // Resolve stdlib path relative to this file (dist/language-server.js → ../stdlib)
  const stdlibPath = path.join(__dirname, "..", "stdlib");

  try {
    // Phase 0: Preprocess (#derive and other directives)
    let processedSource = source;
    if (hasDirectives(source)) {
      try {
        processedSource = preprocess(source, filePath ?? undefined).source;
      } catch {
        // If preprocessing fails (e.g. missing CSV), fall through with raw source
        // so the lexer/parser can still provide partial diagnostics.
      }
    }

    // Phase 1: Lex — collects errors, never throws
    const lexer = new Lexer(processedSource);
    const tokens = lexer.tokenize();
    for (const d of lexer.diagnostics) {
      diagnostics.push(makeDiagnostic(d.message, d.line - 1, d.column - 1, DiagnosticSeverity.Error));
    }

    // Phase 2: Parse — collects errors at statement boundaries, never throws
    const parser = new Parser(tokens);
    const module = parser.parse();
    for (const d of parser.diagnostics) {
      diagnostics.push(makeDiagnostic(d.message, d.line - 1, d.column - 1, DiagnosticSeverity.Error));
    }

    // Phase 3: Validate — always runs even if there were lex/parse errors,
    // so the user sees as many problems as possible in one pass.
    const validator = new Validator(stdlibPath);
    try {
      const issues = validator.validate(module, filePath ?? undefined);
      for (const issue of issues) {
        diagnostics.push(issueToDiagnostic(issue));
      }
    } catch (e: any) {
      // Module resolution failures (missing imports, etc.)
      diagnostics.push(
        makeDiagnostic(e.message, 0, 0, DiagnosticSeverity.Error),
      );
    }
  } catch (e: any) {
    diagnostics.push(
      makeDiagnostic(
        `Internal error: ${e.message}`,
        0,
        0,
        DiagnosticSeverity.Error,
      ),
    );
  }

  connection.sendDiagnostics({ uri, diagnostics });
}

function issueToDiagnostic(issue: ValidationIssue): Diagnostic {
  const severity =
    issue.type === "error"
      ? DiagnosticSeverity.Error
      : DiagnosticSeverity.Warning;
  // Stroum locations are 1-based; LSP is 0-based
  const line = Math.max(0, (issue.location.line ?? 1) - 1);
  const col = Math.max(0, (issue.location.column ?? 1) - 1);
  return {
    severity,
    range: {
      start: { line, character: col },
      end: { line, character: col + 1 },
    },
    message: issue.message,
    source: "stroum",
  };
}

function makeDiagnostic(
  message: string,
  line: number,
  col: number,
  severity: DiagnosticSeverity,
): Diagnostic {
  return {
    severity,
    range: {
      start: { line: Math.max(0, line - 1), character: Math.max(0, col - 1) },
      end: { line: Math.max(0, line - 1), character: Math.max(0, col) },
    },
    message,
    source: "stroum",
  };
}


function uriToPath(uri: string): string | null {
  if (uri.startsWith("file://")) {
    return decodeURIComponent(
      uri.replace(/^file:\/\//, "").replace(/^\/([A-Z]:)/, "$1"),
    );
  }
  return null;
}

// ─── Custom requests ─────────────────────────────────────────────────────────

connection.onRequest("stroum/dataflow", (params: { uri: string }) => {
  const doc = documents.get(params.uri);
  if (!doc) return null;
  try {
    const tokens = new Lexer(doc.getText()).tokenize();
    const ast = new Parser(tokens).parse();
    return analyzeDataflow(ast);
  } catch {
    return null;
  }
});

// ─── Event hooks ────────────────────────────────────────────────────────────

documents.onDidChangeContent((change) => validateDocument(change.document));
documents.onDidOpen((event) => validateDocument(event.document));
documents.onDidSave((event) => validateDocument(event.document));

// Clear diagnostics when a document is closed
documents.onDidClose((event) => {
  connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

// ─── Start ───────────────────────────────────────────────────────────────────

documents.listen(connection);
connection.listen();
