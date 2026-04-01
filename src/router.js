import { create, deleteById, getAll, getById, update, getSetting, setSetting, dbPath } from './db.js';

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(payload === undefined ? '' : JSON.stringify(payload));
}

function sendHtml(res, statusCode, html) {
  res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function sendMethodNotAllowed(res) {
  sendJson(res, 405, { error: 'Method Not Allowed' });
}

function sendNotFound(res) {
  sendJson(res, 404, { error: 'Not Found' });
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function readJsonBody(req) {
  const rawBody = (await readBody(req)).trim();
  if (!rawBody) return {};
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

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export async function router(req, res) {
  const method = req.method ?? 'GET';
  const url = new URL(req.url ?? '/', 'http://localhost');
  const { pathname } = url;

  try {
    // GET / — home page
    if (pathname === '/' && method === 'GET') {
      return sendHtml(res, 200, `<!DOCTYPE html><html><head><title>OC Test App</title></head><body><h1>OC Test App</h1><nav><a href="/settings">Settings</a></nav></body></html>`);
    }

    // GET /settings — settings page
    if (pathname === '/settings' && method === 'GET') {
      const appName = getSetting('app_name') || '';
      const port = process.env.PORT || 3456;
      const html = `<!DOCTYPE html><html><head><title>Settings</title></head><body>
<h1>Settings</h1>
<p>App Name: ${escapeHtml(appName)}</p>
<p>Port: ${escapeHtml(String(port))}</p>
<p>Database Path: ${escapeHtml(dbPath)}</p>
<form method="POST" action="/settings">
<label>App Name: <input name="app_name" value="${escapeHtml(appName)}"></label>
<button type="submit">Save</button>
</form>
</body></html>`;
      return sendHtml(res, 200, html);
    }

    // POST /settings
    if (pathname === '/settings' && method === 'POST') {
      const contentType = (req.headers['content-type'] || '').toLowerCase();
      const isJson = contentType.includes('application/json');
      const raw = await readBody(req);
      let appName;

      if (isJson) {
        const parsed = JSON.parse(raw || '{}');
        appName = parsed.app_name;
      } else {
        const params = new URLSearchParams(raw);
        appName = params.get('app_name');
      }

      const trimmed = (appName ?? '').trim();
      if (!trimmed) {
        return sendJson(res, 400, { error: 'app_name is required' });
      }

      setSetting('app_name', trimmed);

      if (isJson) {
        return sendJson(res, 200, { ok: true, app_name: trimmed });
      }

      res.writeHead(303, { Location: '/settings' });
      return res.end();
    }

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
