import * as http from 'http';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { startGraphServer } from './graph-server';

const GRAPH_JSON = JSON.stringify({ nodes: [], edges: [] });

function get(url: string): Promise<{ status: number; headers: http.IncomingMessage['headers']; body: string }> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
    }).on('error', reject);
  });
}

describe('startGraphServer', () => {
  let server: http.Server;
  let port: number;
  let distDir: string;

  beforeAll(() => {
    // Create a temporary dist directory with a stub bundle
    distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stroum-graph-test-'));
    fs.writeFileSync(path.join(distDir, 'graph-webview.js'), '/* graph-webview stub */');
  });

  beforeEach(async () => {
    server = await startGraphServer({
      port: 0,        // OS assigns a free port
      graphJson: GRAPH_JSON,
      distDir,
      filename: 'test.stm',
    });
    const addr = server.address() as { port: number };
    port = addr.port;
  });

  afterEach((done) => {
    server.close(done);
  });

  afterAll(() => {
    fs.rmSync(distDir, { recursive: true, force: true });
  });

  describe('GET /', () => {
    it('returns HTTP 200', async () => {
      const { status } = await get(`http://127.0.0.1:${port}/`);
      expect(status).toBe(200);
    });

    it('returns text/html content type', async () => {
      const { headers } = await get(`http://127.0.0.1:${port}/`);
      expect(headers['content-type']).toMatch(/text\/html/);
    });

    it('injects __STROUM_GRAPH__ with the provided JSON', async () => {
      const { body } = await get(`http://127.0.0.1:${port}/`);
      expect(body).toContain(`var __STROUM_GRAPH__ = ${GRAPH_JSON}`);
    });

    it('includes the filename in the title', async () => {
      const { body } = await get(`http://127.0.0.1:${port}/`);
      expect(body).toContain('test.stm');
    });

    it('does not contain VSCode nonce placeholders', async () => {
      const { body } = await get(`http://127.0.0.1:${port}/`);
      expect(body).not.toContain('{{nonce}}');
      expect(body).not.toContain('{{');
    });

    it('does not contain VSCode Content-Security-Policy meta tag', async () => {
      const { body } = await get(`http://127.0.0.1:${port}/`);
      expect(body).not.toMatch(/Content-Security-Policy/i);
    });

    it('references the render bundle', async () => {
      const { body } = await get(`http://127.0.0.1:${port}/`);
      expect(body).toContain('src="/graph-webview.js"');
    });
  });

  describe('GET /graph-webview.js', () => {
    it('returns HTTP 200', async () => {
      const { status } = await get(`http://127.0.0.1:${port}/graph-webview.js`);
      expect(status).toBe(200);
    });

    it('returns application/javascript content type', async () => {
      const { headers } = await get(`http://127.0.0.1:${port}/graph-webview.js`);
      expect(headers['content-type']).toMatch(/application\/javascript/);
    });

    it('serves the stub file content', async () => {
      const { body } = await get(`http://127.0.0.1:${port}/graph-webview.js`);
      expect(body).toContain('graph-webview stub');
    });
  });

  describe('unknown routes', () => {
    it('returns 404', async () => {
      const { status } = await get(`http://127.0.0.1:${port}/does-not-exist`);
      expect(status).toBe(404);
    });
  });

  describe('server lifecycle', () => {
    it('resolves only once listening (port is assigned)', async () => {
      // Already validated by the fact that beforeEach succeeds and port > 0
      expect(port).toBeGreaterThan(0);
    });
  });
});
