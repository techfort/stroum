import * as fs from "fs";
import * as http from "http";
import * as path from "path";

export interface GraphServerOptions {
  port: number;
  graphJson: string;
  distDir: string;
  filename: string;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
};

export function startGraphServer(
  opts: GraphServerOptions,
): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = req.url ?? "/";

      if (url === "/") {
        const html = buildHtml(opts);
        res.writeHead(200, { "Content-Type": MIME[".html"] });
        res.end(html);
        return;
      }

      if (url === "/graph-webview.js") {
        const filePath = path.join(opts.distDir, "graph-webview.js");
        serveFile(filePath, MIME[".js"], res);
        return;
      }

      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
    });

    server.on("error", (err: NodeJS.ErrnoException) => {
      reject(err);
    });

    server.listen(opts.port, "127.0.0.1", () => {
      resolve(server);
    });
  });
}

function serveFile(
  filePath: string,
  contentType: string,
  res: http.ServerResponse,
): void {
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
}

function buildHtml(opts: GraphServerOptions): string {
  const title = `Stroum Dataflow — ${opts.filename}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: var(--vscode-editor-background, #1e1e1e);
      color: var(--vscode-editor-foreground, #d4d4d4);
      font-family: var(--vscode-font-family, monospace);
      font-size: var(--vscode-font-size, 13px);
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }

    header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-bottom: 1px solid var(--vscode-panel-border, #303030);
      flex-shrink: 0;
    }

    header h2 {
      font-size: 13px;
      font-weight: 600;
      color: var(--vscode-titleBar-activeForeground, #ccc);
      margin-right: auto;
    }

    #graph {
      flex: 1 1 auto;
      min-height: 0;
    }

    #empty-hint {
      padding: 20px;
      text-align: center;
      color: var(--vscode-descriptionForeground, #666);
      font-size: 12px;
    }
  </style>
</head>
<body>
  <header>
    <h2>${escHtml(title)}</h2>
  </header>

  <div id="graph">
    <div id="empty-hint">Loading graph…</div>
  </div>

  <script>var __STROUM_GRAPH__ = ${opts.graphJson};</script>
  <script src="/graph-webview.js"></script>
</body>
</html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
