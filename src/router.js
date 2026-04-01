import { create, deleteById, getAll, getById, update } from './db.js';
import {
  deleteByKey,
  getAll as getAllSettings,
  getByKey,
  upsert,
} from './settings/settingsDb.js';
import { renderSettingsPage } from './settings/settingsPage.js';

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

function parseSettingKey(pathname) {
  const match = pathname.match(/^\/api\/settings\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function router(req, res) {
  const method = req.method ?? 'GET';
  const url = new URL(req.url ?? '/', 'http://localhost');
  const { pathname } = url;

  try {
    if (pathname === '/settings') {
      if (method !== 'GET') {
        return sendMethodNotAllowed(res);
      }

      return sendHtml(res, 200, renderSettingsPage());
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

    if (pathname === '/api/settings') {
      if (method === 'GET') {
        return sendJson(res, 200, getAllSettings());
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

    const settingKey = parseSettingKey(pathname);

    if (settingKey !== null) {
      if (method === 'GET') {
        const setting = getByKey(settingKey);
        return setting ? sendJson(res, 200, setting) : sendNotFound(res);
      }

      if (method === 'PUT') {
        const body = await readJsonBody(req);
        return sendJson(res, 200, upsert(settingKey, body.value));
      }

      if (method === 'DELETE') {
        const deleted = deleteByKey(settingKey);

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

    if (
      error instanceof Error
      && (error.message === 'key is required' || error.message === 'value must be a string')
    ) {
      return sendJson(res, 400, { error: error.message });
    }

    console.error(error);
    return sendJson(res, 500, { error: 'Internal Server Error' });
  }
}
