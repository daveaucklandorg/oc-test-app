import { countAll, create, deleteById, getById, getPaginated, update } from './db.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function sendJson(res, statusCode, payload, headers = {}) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json', ...headers });
  res.end(payload === undefined ? '' : JSON.stringify(payload));
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

function parsePagination(searchParams) {
  const limitParam = searchParams.get('limit');
  const offsetParam = searchParams.get('offset');

  let limit = DEFAULT_LIMIT;
  let offset = 0;

  if (limitParam !== null) {
    limit = Number(limitParam);

    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error('limit must be a positive integer');
    }

    limit = Math.min(limit, MAX_LIMIT);
  }

  if (offsetParam !== null) {
    offset = Number(offsetParam);

    if (!Number.isInteger(offset) || offset < 0) {
      throw new Error('offset must be a non-negative integer');
    }
  }

  return { limit, offset };
}

function buildPageUrl(url, req, offset, limit) {
  const pageUrl = new URL(url.pathname, `http://${req.headers.host ?? 'localhost'}`);
  pageUrl.searchParams.set('limit', String(limit));
  pageUrl.searchParams.set('offset', String(offset));
  return pageUrl.toString();
}

function buildLinkHeader(url, req, total, limit, offset) {
  const links = [];
  const lastOffset = total === 0 ? 0 : Math.floor((total - 1) / limit) * limit;

  links.push(`<${buildPageUrl(url, req, 0, limit)}>; rel="first"`);
  links.push(`<${buildPageUrl(url, req, lastOffset, limit)}>; rel="last"`);

  if (offset > 0) {
    links.push(`<${buildPageUrl(url, req, Math.max(0, offset - limit), limit)}>; rel="prev"`);
  }

  if (offset + limit < total) {
    links.push(`<${buildPageUrl(url, req, offset + limit, limit)}>; rel="next"`);
  }

  return links.join(', ');
}

export async function router(req, res) {
  const method = req.method ?? 'GET';
  const url = new URL(req.url ?? '/', 'http://localhost');
  const { pathname } = url;

  try {
    if (pathname === '/api/health') {
      if (method !== 'GET') {
        return sendMethodNotAllowed(res);
      }

      return sendJson(res, 200, { status: 'ok' });
    }

    if (pathname === '/api/contacts') {
      if (method === 'GET') {
        const { limit, offset } = parsePagination(url.searchParams);
        const total = countAll();
        const data = getPaginated(limit, offset);
        const link = buildLinkHeader(url, req, total, limit, offset);

        return sendJson(
          res,
          200,
          {
            data,
            pagination: {
              total,
              limit,
              offset,
            },
          },
          { Link: link },
        );
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

    if (
      error instanceof Error
      && (error.message === 'limit must be a positive integer'
        || error.message === 'offset must be a non-negative integer')
    ) {
      return sendJson(res, 400, { error: error.message });
    }

    console.error(error);
    return sendJson(res, 500, { error: 'Internal Server Error' });
  }
}
