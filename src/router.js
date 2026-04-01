import { create, deleteById, getAll, getById, update } from './db.js';

function sendJson(res, statusCode, payload, headers = {}) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json', ...headers });
  res.end(payload === undefined ? '' : JSON.stringify(payload));
}

function sendMethodNotAllowed(res, allow) {
  const headers = allow ? { Allow: allow } : {};
  sendJson(res, 405, { error: 'Method not allowed' }, headers);
}

function sendBadRequest(res, message) {
  sendJson(res, 400, { error: message });
}

function sendNotFound(res) {
  sendJson(res, 404, { error: 'Not Found' });
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

function validateCreateContactBody(body) {
  if (!body || Array.isArray(body) || typeof body !== 'object') {
    return 'Request body must be a JSON object';
  }

  if (typeof body.name !== 'string' || body.name.trim().length === 0 || body.name.length > 100) {
    return 'name is required and must be a string (max 100 characters)';
  }

  if (
    body.description !== undefined &&
    (typeof body.description !== 'string' || body.description.length > 500)
  ) {
    return 'description must be a string (max 500 characters)';
  }

  return null;
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
    if (pathname === '/api/health') {
      if (method !== 'GET') {
        return sendMethodNotAllowed(res, 'GET');
      }

      return sendJson(res, 200, { status: 'ok' });
    }

    if (pathname === '/api/contacts') {
      if (method === 'GET') {
        return sendJson(res, 200, getAll());
      }

      if (method === 'POST') {
        const body = await readJsonBody(req);
        const validationError = validateCreateContactBody(body);

        if (validationError) {
          return sendBadRequest(res, validationError);
        }

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
    if (error instanceof Error && [
      'Invalid JSON body',
      'name is required and must be a string (max 100 characters)',
      'description must be a string (max 500 characters)',
      'email must be a string if provided',
      'phone must be a string if provided',
    ].includes(error.message)) {
      return sendJson(res, 400, { error: error.message });
    }

    console.error(error);
    return sendJson(res, 500, { error: 'Internal Server Error' });
  }
}
