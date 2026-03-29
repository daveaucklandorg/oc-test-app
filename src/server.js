import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { create, deleteById, getAll, getById, update } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '..', 'public');
const indexPath = path.join(publicDir, 'index.html');
const PORT = process.env.PORT || 3456;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.ico': 'image/x-icon',
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function sendEmpty(res, statusCode) {
  res.writeHead(statusCode);
  res.end();
}

function sendText(res, statusCode, message) {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(message);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;

      if (body.length > 1_000_000) {
        reject(new Error('request body too large'));
        req.destroy();
      }
    });

    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('invalid json'));
      }
    });

    req.on('error', reject);
  });
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendText(res, 404, 'Not found');
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const requestedPath = decodeURIComponent(url.pathname);

  if (requestedPath === '/' || !path.extname(requestedPath)) {
    serveFile(res, indexPath);
    return;
  }

  const normalizedPath = path.normalize(requestedPath).replace(/^([.][.][/\\])+/, '');
  const filePath = path.join(publicDir, normalizedPath);

  if (!filePath.startsWith(publicDir)) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  serveFile(res, filePath);
}

async function requestHandler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const { pathname } = url;

  if (req.method === 'GET' && pathname === '/api/health') {
    sendJson(res, 200, { status: 'ok' });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/contacts') {
    sendJson(res, 200, getAll());
    return;
  }

  const contactMatch = pathname.match(/^\/api\/contacts\/(\d+)$/);
  if (contactMatch) {
    const id = Number(contactMatch[1]);

    if (req.method === 'GET') {
      const contact = getById(id);
      if (!contact) {
        sendJson(res, 404, { error: 'Contact not found' });
        return;
      }

      sendJson(res, 200, contact);
      return;
    }

    if (req.method === 'PUT') {
      try {
        const payload = await readJsonBody(req);
        const contact = update(id, payload);

        if (!contact) {
          sendJson(res, 404, { error: 'Contact not found' });
          return;
        }

        sendJson(res, 200, contact);
      } catch (error) {
        sendJson(res, 400, { error: error.message });
      }
      return;
    }

    if (req.method === 'DELETE') {
      const deleted = deleteById(id);
      if (!deleted) {
        sendJson(res, 404, { error: 'Contact not found' });
        return;
      }

      sendEmpty(res, 204);
      return;
    }
  }

  if (req.method === 'POST' && pathname === '/api/contacts') {
    try {
      const payload = await readJsonBody(req);
      const contact = create(payload);
      sendJson(res, 201, contact);
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  if (!pathname.startsWith('/api/')) {
    serveStatic(req, res);
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
}

function createServer() {
  return http.createServer((req, res) => {
    requestHandler(req, res).catch((error) => {
      sendJson(res, 500, { error: error.message || 'Internal server error' });
    });
  });
}

const server = createServer();

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => {
    console.log(`Listening on :${PORT}`);
  });
}

export { createServer, server };
