#!/usr/bin/env node
/**
 * Stroum Language Server (Phase 1 — Diagnostics)
 *
 * Implements the Language Server Protocol over stdio.
 * On every document open/change/save it runs the full
 * Stroum compiler pipeline (lexer → parser → validator)
 * and publishes diagnostics to the client.
 */

import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
  Diagnostic,
  DiagnosticSeverity,
  DidChangeConfigurationNotification,
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import * as path from 'path';
import { Lexer } from './lexer';
import { Parser } from './parser';
import { Validator, ValidationIssue } from './validator';
import { analyzeDataflow } from './dataflow-analyzer';

// ─── Connection ─────────────────────────────────────────────────────────────

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

let hasConfigCapability = false;
let hasWorkspaceFolderCapability = false;

connection.onInitialize((params: InitializeParams): InitializeResult => {
  const caps = params.capabilities;
  hasConfigCapability = !!(caps.workspace && caps.workspace.configuration);
  hasWorkspaceFolderCapability = !!(caps.workspace && caps.workspace.workspaceFolders);

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
    },
  };
});

connection.onInitialized(() => {
  if (hasConfigCapability) {
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
  }
});

// ─── Diagnostics ────────────────────────────────────────────────────────────

function validateDocument(doc: TextDocument): void {
  const uri = doc.uri;
  const filePath = uriToPath(uri);
  const source = doc.getText();
  const diagnostics: Diagnostic[] = [];

  // Resolve stdlib path relative to this file (dist/language-server.js → ../stdlib)
  const stdlibPath = path.join(__dirname, '..', 'stdlib');

  try {
    // Phase 1: Lex
    const lexer = new Lexer(source);
    let tokens;
    try {
      tokens = lexer.tokenize();
    } catch (e: any) {
      diagnostics.push(makeDiagnostic(e.message, 0, 0, DiagnosticSeverity.Error));
      connection.sendDiagnostics({ uri, diagnostics });
      return;
    }

    // Phase 2: Parse
    const parser = new Parser(tokens);
    let module;
    try {
      module = parser.parse();
    } catch (e: any) {
      // Extract line/col from parser error message if present
      const loc = parseErrorLocation(e.message);
      diagnostics.push(makeDiagnostic(e.message, loc.line, loc.col, DiagnosticSeverity.Error));
      connection.sendDiagnostics({ uri, diagnostics });
      return;
    }

    // Phase 3: Validate
    // Always validate the already-parsed in-memory module.
    // Pass filePath so the validator can resolve relative imports from disk.
    const validator = new Validator(stdlibPath);
    try {
      const issues = validator.validate(module, filePath ?? undefined);
      for (const issue of issues) {
        diagnostics.push(issueToDiagnostic(issue));
      }
    } catch (e: any) {
      // Module resolution failures (missing imports, etc.)
      diagnostics.push(makeDiagnostic(e.message, 0, 0, DiagnosticSeverity.Error));
    }
  } catch (e: any) {
    diagnostics.push(makeDiagnostic(`Internal error: ${e.message}`, 0, 0, DiagnosticSeverity.Error));
  }

  connection.sendDiagnostics({ uri, diagnostics });
}

function issueToDiagnostic(issue: ValidationIssue): Diagnostic {
  const severity = issue.type === 'error' ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning;
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
    source: 'stroum',
  };
}

function makeDiagnostic(message: string, line: number, col: number, severity: DiagnosticSeverity): Diagnostic {
  return {
    severity,
    range: {
      start: { line: Math.max(0, line - 1), character: Math.max(0, col - 1) },
      end: { line: Math.max(0, line - 1), character: Math.max(0, col) },
    },
    message,
    source: 'stroum',
  };
}

function parseErrorLocation(msg: string): { line: number; col: number } {
  // Matches "line N, col M" or "Line N:M" patterns in error messages
  const m = msg.match(/line[:\s]+(\d+)[,\s]+col[:\s]+(\d+)/i)
    ?? msg.match(/(\d+):(\d+)/);
  if (m) return { line: parseInt(m[1], 10), col: parseInt(m[2], 10) };
  return { line: 1, col: 1 };
}

function uriToPath(uri: string): string | null {
  if (uri.startsWith('file://')) {
    return decodeURIComponent(uri.replace(/^file:\/\//, '').replace(/^\/([A-Z]:)/, '$1'));
  }
  return null;
}

// ─── Custom requests ─────────────────────────────────────────────────────────

connection.onRequest('stroum/dataflow', (params: { uri: string }) => {
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

documents.onDidChangeContent(change => validateDocument(change.document));
documents.onDidOpen(event => validateDocument(event.document));
documents.onDidSave(event => validateDocument(event.document));

// Clear diagnostics when a document is closed
documents.onDidClose(event => {
  connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

// ─── Start ───────────────────────────────────────────────────────────────────

documents.listen(connection);
connection.listen();
