/**
 * Sirve el build de Angular en producción (Railway, Docker, etc.).
 * SPA fallback solo para rutas de navegación — no para *.js/css (evita NG0750
 * cuando un chunk viejo pide HTML con MIME text/html).
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', 'dist', 'terminalops-app', 'browser');
const port = Number(process.env.PORT ?? '3000');

const MIME_BY_EXT = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
};

/** Rutas de assets: si faltan en disco, 404 (no index.html). */
const ASSET_PATH = /\.(js|mjs|css|map|json|ico|png|svg|webp|woff2?)$/i;

function resolveFilePath(urlPath) {
  const normalized = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const joined = path.join(root, normalized);
  if (!joined.startsWith(root)) {
    return null;
  }
  return joined;
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') {
      pathname = '/index.html';
    }
    const filePath = resolveFilePath(pathname);
    if (!filePath) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      const fileStat = await stat(filePath);
      if (fileStat.isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const body = await readFile(filePath);
        const headers = {
          'Content-Type': MIME_BY_EXT[ext] ?? 'application/octet-stream',
        };
        if (ext === '.html') {
          headers['Cache-Control'] = 'no-cache';
        }
        res.writeHead(200, headers);
        res.end(body);
        return;
      }
    } catch {
      // archivo inexistente
    }

    if (ASSET_PATH.test(pathname)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const indexPath = path.join(root, 'index.html');
    const body = await readFile(indexPath);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(500);
    res.end();
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`TerminalOps app: http://0.0.0.0:${port} (${root})`);
});