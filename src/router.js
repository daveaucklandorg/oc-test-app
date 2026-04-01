import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { create, deleteById, getAll, getById, update } from './db.js';
import { markdownToHtml } from './markdown.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(payload === undefined ? '' : JSON.stringify(payload));
}

function sendMethodNotAllowed(res) {
  sendJson(res, 405, { error: 'Method Not Allowed' });
}

function sendNotFound(res) {
  sendJson(res, 404, { error: 'Not Found' });
}

function serveStaticFile(res, filePath) {
  const ext = path.extname(filePath);
  const contentTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
  };
  const contentType = contentTypes[ext] || 'application/octet-stream';

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    sendNotFound(res);
  }
}

async function readJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const rawBody = Buffer.concat(chunks).toString('utf8').trim();

  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new Error('Invalid JSON body');
  }
}

function parseContactId(pathname) {
  const match = pathname.match(/^\/api\/contacts\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

export async function router(req, res) {
  const method = req.method ?? 'GET';
  const url = new URL(req.url ?? '/', 'http://localhost');
  const { pathname } = url;

  try {
    // Health endpoint
    if (pathname === '/api/health') {
      if (method !== 'GET') {
        return sendMethodNotAllowed(res);
      }

      return sendJson(res, 200, { status: 'ok' });
    }

    // Markdown preview API
    if (pathname === '/api/markdown') {
      if (method !== 'POST') {
        return sendMethodNotAllowed(res);
      }

      const body = await readJsonBody(req);

      if (typeof body.markdown !== 'string') {
        return sendJson(res, 400, { error: 'markdown field is required and must be a string' });
      }

      const html = markdownToHtml(body.markdown);
      return sendJson(res, 200, { html });
    }

    // Markdown preview page
    if (pathname === '/markdown' || pathname === '/markdown.html') {
      if (method !== 'GET') {
        return sendMethodNotAllowed(res);
      }
      return serveStaticFile(res, path.join(publicDir, 'markdown.html'));
    }

    // Contacts API
    if (pathname === '/api/contacts') {
      if (method === 'GET') {
        return sendJson(res, 200, getAll());
      }

      if (method === 'POST') {
        const body = await readJsonBody(req);
        const contact = create(body);
        return sendJson(res, 201, contact);
      }

      return sendMethodNotAllowed(res);
    }

    const contactId = parseContactId(pathname);

    if (contactId !== null) {
      if (method === 'GET') {
        const contact = getById(contactId);
        return contact ? sendJson(res, 200, contact) : sendNotFound(res);
      }

      if (method === 'PUT') {
        const body = await readJsonBody(req);
        const contact = update(contactId, body);
        return contact ? sendJson(res, 200, contact) : sendNotFound(res);
      }

      if (method === 'DELETE') {
        const deleted = deleteById(contactId);

        if (!deleted) {
          return sendNotFound(res);
        }

        res.writeHead(204, { 'Content-Type': 'application/json' });
        return res.end();
      }

      return sendMethodNotAllowed(res);
    }

    return sendNotFound(res);
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid JSON body') {
      return sendJson(res, 400, { error: error.message });
    }

    if (error instanceof Error && error.message === 'name is required') {
      return sendJson(res, 400, { error: error.message });
    }

    console.error(error);
    return sendJson(res, 500, { error: 'Internal Server Error' });
  }
}
