import * as path from 'path';
import * as fs from 'fs';
import * as net from 'net';
import * as cp from 'child_process';
import * as os from 'os';
import * as crypto from 'crypto';
import { workspace, ExtensionContext, window, commands, TextDocument, Uri, WebviewPanel, ViewColumn } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext): void {
  // ── Language server ────────────────────────────────────────────────────────
  let serverModule: string | undefined;
  for (const folder of workspace.workspaceFolders ?? []) {
    const candidate = path.join(folder.uri.fsPath, 'dist', 'language-server.js');
    if (fs.existsSync(candidate)) {
      serverModule = candidate;
      break;
    }
  }

  if (serverModule) {
    const serverOptions: ServerOptions = {
      run: { module: serverModule, transport: TransportKind.ipc },
      debug: {
        module: serverModule,
        transport: TransportKind.ipc,
        options: { execArgv: ['--nolazy', '--inspect=6009'] },
      },
    };

    const clientOptions: LanguageClientOptions = {
      documentSelector: [{ scheme: 'file', language: 'stroum' }],
      synchronize: {
        fileEvents: workspace.createFileSystemWatcher('**/*.stm'),
      },
    };

    client = new LanguageClient('stroum', 'Stroum Language Server', serverOptions, clientOptions);
    client.start();
  } else {
    void window.showWarningMessage(
      'Stroum: could not find dist/language-server.js — run "npm run build" for diagnostics and dataflow graph support.'
    );
  }

  // ── Dataflow panel command ─────────────────────────────────────────────────
  context.subscriptions.push(
    commands.registerCommand('stroum.showDataflowPanel', () => {
      const doc = window.activeTextEditor?.document;
      if (!doc || !doc.fileName.endsWith('.stm')) {
        void window.showErrorMessage('Stroum: open a .stm file first');
        return;
      }
      DataflowPanel.createOrShow(context.extensionUri, doc);
    })
  );

  // Refresh graph when the active .stm file changes
  context.subscriptions.push(
    window.onDidChangeActiveTextEditor(e => {
      if (e?.document.fileName.endsWith('.stm')) {
        DataflowPanel.current?.loadGraph(e.document);
      }
    })
  );
}

export function deactivate(): Thenable<void> | undefined {
  DataflowPanel.current?.dispose();
  if (!client) return undefined;
  return client.stop();
}

// ─── DataflowPanel ────────────────────────────────────────────────────────────

class DataflowPanel {
  static current: DataflowPanel | undefined;

  private readonly _panel: WebviewPanel;
  private readonly _extensionUri: Uri;
  private _doc: TextDocument;
  private _child: cp.ChildProcess | undefined;
  private _server: net.Server | undefined;
  private _socketPath: string | undefined;

  static createOrShow(extensionUri: Uri, doc: TextDocument): void {
    if (DataflowPanel.current) {
      DataflowPanel.current._doc = doc;
      DataflowPanel.current._panel.reveal(ViewColumn.Beside);
      void DataflowPanel.current.loadGraph(doc);
      return;
    }
    const panel = window.createWebviewPanel(
      'stroumDataflow',
      'Stroum Dataflow',
      ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [Uri.joinPath(extensionUri, 'media')],
        retainContextWhenHidden: true,
      }
    );
    DataflowPanel.current = new DataflowPanel(panel, extensionUri, doc);
  }

  private constructor(panel: WebviewPanel, extensionUri: Uri, doc: TextDocument) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._doc = doc;

    this._panel.webview.html = this._buildHtml();
    this._panel.onDidDispose(() => this.dispose());
    this._panel.webview.onDidReceiveMessage(msg => this._handleMessage(msg));
  }

  async loadGraph(doc: TextDocument): Promise<void> {
    this._doc = doc;
    if (!client) return;
    try {
      const graph = await client.sendRequest('stroum/dataflow', { uri: doc.uri.toString() });
      if (graph) {
        void this._panel.webview.postMessage({ type: 'graph', ...(graph as object) });
      }
    } catch {
      // Language server may not be ready yet — ignore
    }
  }

  private _handleMessage(msg: { type: string }): void {
    switch (msg.type) {
      case 'ready':
        void this.loadGraph(this._doc);
        break;
      case 'run':
        void this._startRun();
        break;
      case 'stop':
        this._stopRun();
        break;
    }
  }

  private async _startRun(): Promise<void> {
    this._stopRun(); // ensure clean state

    this._socketPath = path.join(os.tmpdir(), `stroum-${Date.now()}.sock`);

    this._server = net.createServer(socket => {
      let buf = '';
      socket.on('data', chunk => {
        buf += chunk.toString();
        const lines = buf.split('\n');
        buf = lines.pop()!;
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line) as { type: string };
            if (msg.type === 'event' || msg.type === 'exit') {
              void this._panel.webview.postMessage(msg);
            }
            if (msg.type === 'exit') this._stopRun();
          } catch {
            // malformed JSON — ignore
          }
        }
      });
    });

    await new Promise<void>((resolve, reject) => {
      this._server!.listen(this._socketPath!, (err?: Error) => {
        if (err) reject(err); else resolve();
      });
    });

    // Find the stroum CLI in the workspace
    let cliPath: string | undefined;
    for (const folder of workspace.workspaceFolders ?? []) {
      const candidate = path.join(folder.uri.fsPath, 'dist', 'cli.js');
      if (fs.existsSync(candidate)) { cliPath = candidate; break; }
    }

    if (!cliPath) {
      void window.showErrorMessage('Stroum: could not find dist/cli.js. Run "npm run build" first.');
      this._stopRun();
      return;
    }

    void this._panel.webview.postMessage({ type: 'status', state: 'running' });

    this._child = cp.spawn('node', [cliPath, 'run', this._doc.fileName, '--ipc', this._socketPath!], {
      stdio: 'pipe',
    });

    this._child.on('exit', () => this._stopRun());
    this._child.on('error', (err) => {
      void this._panel.webview.postMessage({ type: 'status', state: 'error', message: err.message });
      this._stopRun();
    });
  }

  private _stopRun(): void {
    try { this._child?.kill(); } catch {}
    try { this._server?.close(); } catch {}
    if (this._socketPath) {
      try { fs.unlinkSync(this._socketPath); } catch {}
      this._socketPath = undefined;
    }
    this._child = undefined;
    this._server = undefined;
    void this._panel.webview.postMessage({ type: 'status', state: 'stopped' });
  }

  private _buildHtml(): string {
    const webview = this._panel.webview;
    const mediaUri = Uri.joinPath(this._extensionUri, 'media');

    function res(rel: string): string {
      return webview.asWebviewUri(Uri.joinPath(mediaUri, rel)).toString();
    }

    const nonce = crypto.randomBytes(16).toString('hex');

    // Read the HTML template and substitute placeholders
    const htmlPath = path.join(this._extensionUri.fsPath, 'media', 'dataflow.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    html = html
      .replace(/\{\{nonce\}\}/g, nonce)
      .replace(/\{\{([^}]+)\}\}/g, (_, rel: string) => res(rel.trim()));

    return html;
  }

  dispose(): void {
    this._stopRun();
    DataflowPanel.current = undefined;
    this._panel.dispose();
  }
}
