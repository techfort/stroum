import * as path from 'path';
import * as fs from 'fs';
import { workspace, ExtensionContext, window } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext): void {
  // Find the language server in the workspace's dist/ folder.
  // When installed as a VSIX the extension root is inside VS Code's extensions
  // directory, NOT inside the stroum project — so we can't use
  // context.asAbsolutePath('../dist/…'). Instead, walk workspace folders to
  // find the one that actually contains dist/language-server.js.
  let serverModule: string | undefined;
  for (const folder of workspace.workspaceFolders ?? []) {
    const candidate = path.join(folder.uri.fsPath, 'dist', 'language-server.js');
    if (fs.existsSync(candidate)) {
      serverModule = candidate;
      break;
    }
  }

  if (!serverModule) {
    void window.showErrorMessage(
      'Stroum: could not find dist/language-server.js in any workspace folder. Run "npm run build" in the stroum project.'
    );
    return;
  }

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

  client = new LanguageClient(
    'stroum',
    'Stroum Language Server',
    serverOptions,
    clientOptions
  );

  client.start();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
