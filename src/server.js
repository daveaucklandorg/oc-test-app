import http from 'node:http';
import { create, deleteById, getAll, getById, update } from './db.js';

const DEFAULT_PORT = 3456;

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');

  if (!rawBody.trim()) {
    return {};
  }

  return JSON.parse(rawBody);
}

async function requestHandler(req, res) {
  const method = req.method ?? 'GET';
  const url = new URL(req.url ?? '/', 'http://localhost');
  const contactMatch = url.pathname.match(/^\/api\/contacts\/(\d+)$/);

  try {
    if (method === 'GET' && url.pathname === '/api/health') {
      return sendJson(res, 200, { status: 'ok' });
    }

    if (method === 'GET' && url.pathname === '/api/contacts') {
      return sendJson(res, 200, getAll());
    }

    if (contactMatch) {
      const id = Number(contactMatch[1]);

      if (method === 'GET') {
        const contact = getById(id);
        return contact
          ? sendJson(res, 200, contact)
          : sendJson(res, 404, { error: 'contact not found' });
      }

      if (method === 'PUT') {
        const body = await readJsonBody(req);
        const contact = update(id, body);
        return contact
          ? sendJson(res, 200, contact)
          : sendJson(res, 404, { error: 'contact not found' });
      }

      if (method === 'DELETE') {
        const deleted = deleteById(id);

        if (!deleted) {
          return sendJson(res, 404, { error: 'contact not found' });
        }

        res.writeHead(204);
        return res.end();
      }
    }

    if (method === 'POST' && url.pathname === '/api/contacts') {
      const body = await readJsonBody(req);
      const contact = create(body);
      return sendJson(res, 201, contact);
    }

    return sendJson(res, 404, { error: 'not found' });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return sendJson(res, 400, { error: 'invalid JSON body' });
    }

    if (error instanceof Error && error.message === 'name is required') {
      return sendJson(res, 400, { error: error.message });
    }

    console.error(error);
    return sendJson(res, 500, { error: 'internal server error' });
  }
}

export function createServer() {
  return http.createServer((req, res) => {
    void requestHandler(req, res);
  });
}

export const server = createServer();

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const port = Number(process.env.PORT) || DEFAULT_PORT;
  server.listen(port, () => {
    console.log(`Listening on :${port}`);
  });
}
