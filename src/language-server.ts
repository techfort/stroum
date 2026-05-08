#!/usr/bin/env node

import * as path from "node:path";
import {
  type CompletionItem,
  type CompletionParams,
  createConnection,
  type Definition,
  type DefinitionParams,
  type Diagnostic,
  DiagnosticSeverity,
  DidChangeConfigurationNotification,
  type Hover,
  type HoverParams,
  type InitializeParams,
  type InitializeResult,
  Location,
  MarkupKind,
  ProposedFeatures,
  Range,
  TextDocumentSyncKind,
  TextDocuments,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import type * as AST from "./ast";
import { analyzeDataflow } from "./dataflow-analyzer";
import { format } from "./formatter";
import { Lexer } from "./lexer";
import { getCompletions, getHover } from "./lsp-completion";
import { Parser } from "./parser";
import { hasDirectives, preprocess } from "./preprocessor";
import { type ValidationIssue, Validator } from "./validator";

// ─── Connection ──────────────────────────────────────────────────────────────

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

let hasConfigCapability = false;

// Cache last-parsed AST per document URI for completion requests
const astCache = new Map<string, AST.Module>();

connection.onInitialize((params: InitializeParams): InitializeResult => {
  const caps = params.capabilities;
  hasConfigCapability = !!caps.workspace?.configuration;

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: [":", ".", "|", " "],
      },
      definitionProvider: true,
      documentFormattingProvider: true,
      hoverProvider: true,
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

// ─── Diagnostics ─────────────────────────────────────────────────────────────

function validateDocument(doc: TextDocument): void {
  const uri = doc.uri;
  const filePath = uriToPath(uri);
  const source = doc.getText();
  const diagnostics: Diagnostic[] = [];

  const stdlibPath = path.join(__dirname, "..", "stdlib");

  try {
    let processedSource = source;
    if (hasDirectives(source)) {
      try {
        processedSource = preprocess(source, filePath ?? undefined).source;
      } catch {
        // Fall through with raw source so lex/parse still provide diagnostics
      }
    }

    const lexer = new Lexer(processedSource);
    const tokens = lexer.tokenize();
    for (const d of lexer.diagnostics) {
      diagnostics.push(
        makeDiagnostic(
          d.message,
          d.line - 1,
          d.column - 1,
          DiagnosticSeverity.Error,
        ),
      );
    }

    const parser = new Parser(tokens);
    const module = parser.parse();
    astCache.set(uri, module);

    for (const d of parser.diagnostics) {
      diagnostics.push(
        makeDiagnostic(
          d.message,
          d.line - 1,
          d.column - 1,
          DiagnosticSeverity.Error,
        ),
      );
    }

    const validator = new Validator(stdlibPath);
    try {
      const issues = validator.validate(module, filePath ?? undefined);
      for (const issue of issues) {
        diagnostics.push(issueToDiagnostic(issue));
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      diagnostics.push(makeDiagnostic(msg, 0, 0, DiagnosticSeverity.Error));
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    diagnostics.push(
      makeDiagnostic(`Internal error: ${msg}`, 0, 0, DiagnosticSeverity.Error),
    );
  }

  connection.sendDiagnostics({ uri, diagnostics });
}

function issueToDiagnostic(issue: ValidationIssue): Diagnostic {
  const severity =
    issue.type === "error"
      ? DiagnosticSeverity.Error
      : DiagnosticSeverity.Warning;
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

// ─── Completion ───────────────────────────────────────────────────────────────

connection.onCompletion((params: CompletionParams): CompletionItem[] => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];

  // Re-use the cached AST if available; otherwise parse on demand
  let module = astCache.get(params.textDocument.uri);
  if (!module) {
    try {
      const tokens = new Lexer(doc.getText()).tokenize();
      module = new Parser(tokens).parse();
      astCache.set(params.textDocument.uri, module);
    } catch {
      return [];
    }
  }

  // Text on the current line up to the cursor
  const lines = doc.getText().split("\n");
  const linePrefix =
    lines[params.position.line]?.slice(0, params.position.character) ?? "";

  // stdlib is auto-imported unless the file explicitly opts out
  const hasStdlib = !doc.getText().includes("--no-stdlib");

  return getCompletions(module, linePrefix, hasStdlib);
});

// ─── Go-to-definition ────────────────────────────────────────────────────────

connection.onDefinition((params: DefinitionParams): Definition | null => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;

  const module = astCache.get(params.textDocument.uri);
  if (!module) return null;

  const lines = doc.getText().split("\n");
  const line = lines[params.position.line] ?? "";
  // Extract the word at the cursor position
  const before = line.slice(0, params.position.character);
  const after = line.slice(params.position.character);
  const wordMatch = /(\w+)$/.exec(before);
  const word = wordMatch
    ? wordMatch[1] + (after.match(/^\w+/)?.[0] ?? "")
    : null;
  if (!word) return null;

  // Search all definitions in the module for a matching name
  for (const def of module.definitions) {
    if (def.name === word) {
      const defLine = Math.max(0, (def.location.line ?? 1) - 1);
      const defCol = Math.max(0, (def.location.column ?? 1) - 1);
      return Location.create(
        params.textDocument.uri,
        Range.create(defLine, defCol, defLine, defCol + word.length),
      );
    }
  }

  return null;
});

// ─── Document formatting ──────────────────────────────────────────────────────

connection.onDocumentFormatting((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];

  try {
    const source = doc.getText();
    const tokens = new Lexer(source).tokenize();
    const module = new Parser(tokens).parse();
    const formatted = format(module);

    if (formatted === source) return [];

    const lineCount = source.split("\n").length;
    return [
      {
        range: Range.create(0, 0, lineCount, 0),
        newText: formatted,
      },
    ];
  } catch {
    return [];
  }
});

// ─── Hover ────────────────────────────────────────────────────────────────────

connection.onHover((params: HoverParams): Hover | null => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;

  let module = astCache.get(params.textDocument.uri);
  if (!module) {
    try {
      const tokens = new Lexer(doc.getText()).tokenize();
      module = new Parser(tokens).parse();
      astCache.set(params.textDocument.uri, module);
    } catch {
      return null;
    }
  }

  const lines = doc.getText().split("\n");
  const line = lines[params.position.line] ?? "";
  const ch = params.position.character;
  const wordMatch = line.slice(0, ch + 1).match(/\w+$/) ?? null;
  const rightPart = line.slice(ch).match(/^\w*/) ?? null;
  const word = (wordMatch?.[0] ?? "") + (rightPart?.[0]?.slice(1) ?? "");

  if (!word) return null;

  const hover = getHover(word, module);
  if (!hover) return null;

  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: `\`\`\`stroum\n${hover.signature}\n\`\`\`\n\n${hover.doc}`,
    },
  };
});

// ─── Custom requests ──────────────────────────────────────────────────────────

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

// ─── Event hooks ─────────────────────────────────────────────────────────────

documents.onDidChangeContent((change) => validateDocument(change.document));
documents.onDidOpen((event) => validateDocument(event.document));
documents.onDidSave((event) => validateDocument(event.document));

documents.onDidClose((event) => {
  astCache.delete(event.document.uri);
  connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

// ─── Start ────────────────────────────────────────────────────────────────────

documents.listen(connection);
connection.listen();
