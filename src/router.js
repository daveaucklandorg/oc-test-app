import { create, deleteById, getAll, getById, update } from './db.js';
import { AppError } from './errors/AppError.js';

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(payload === undefined ? '' : JSON.stringify(payload));
}

function sendMethodNotAllowed(res) {
  throw new AppError('Method Not Allowed', 405);
}

function sendNotFound(res) {
  throw new AppError('Not Found', 404);
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
    throw new AppError('Invalid JSON body', 400);
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

  if (pathname === '/api/health') {
    if (method !== 'GET') {
      return sendMethodNotAllowed(res);
    }

    return sendJson(res, 200, { status: 'ok' });
  }

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
}
