import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { router } from './router.js';

const PORT = Number(process.env.PORT || 3456);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '..', 'public');

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

async function serveStatic(req, res) {
  const method = req.method ?? 'GET';

  if (method !== 'GET' && method !== 'HEAD') {
    return sendJson(res, 404, { error: 'Not Found' });
  }

  const url = new URL(req.url ?? '/', 'http://localhost');
  const requestedPath = decodeURIComponent(url.pathname);
  const relativePath = requestedPath === '/' ? 'index.html' : requestedPath.replace(/^\/+/, '');
  const resolvedPath = path.resolve(publicDir, relativePath);

  if (!resolvedPath.startsWith(publicDir)) {
    return sendJson(res, 404, { error: 'Not Found' });
  }

  const indexPath = path.join(publicDir, 'index.html');

  try {
    const stats = await fs.stat(resolvedPath).catch(() => null);
    const filePath = stats?.isFile() ? resolvedPath : indexPath;
    const content = await fs.readFile(filePath);
    const extname = path.extname(filePath).toLowerCase();
    const contentType = CONTENT_TYPES[extname] ?? 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });

    if (method === 'HEAD') {
      return res.end();
    }

    return res.end(content);
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { error: 'Internal Server Error' });
  }
}

function createApp() {
  return http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (url.pathname.startsWith('/api/')) {
      Promise.resolve(router(req, res)).catch((error) => {
        console.error(error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
      });
      return;
    }

    Promise.resolve(serveStatic(req, res)).catch((error) => {
      console.error(error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    });
  });
}

const server = createApp();

function startServer(port = PORT) {
  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`Listening on :${port}`);
      resolve(server);
    });
  });
}

const isMainModule = process.argv[1] && __filename === process.argv[1];

if (isMainModule) {
  startServer();
}

export { createApp, server, startServer };
