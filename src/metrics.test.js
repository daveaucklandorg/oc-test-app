import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '..', 'data', 'contacts.db');

let server;
let baseUrl;

test.before(async () => {
  fs.rmSync(dbPath, { force: true });

  const { resetRequestCount } = await import('./router.js');
  resetRequestCount();

  const { startServer } = await import('./server.js');
  server = await startServer(0);

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  fs.rmSync(dbPath, { force: true });
});

test('GET /metrics returns JSON with requestCount', async () => {
  const { resetRequestCount } = await import('./router.js');
  resetRequestCount();

  const res = await fetch(`${baseUrl}/metrics`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/json');

  const body = await res.json();
  assert.equal(typeof body.requestCount, 'number');
  assert.equal(body.requestCount, 1);
});

test('counter increments on every request including /metrics', async () => {
  const { resetRequestCount } = await import('./router.js');
  resetRequestCount();

  await fetch(`${baseUrl}/api/health`);
  await fetch(`${baseUrl}/api/contacts`);
  await fetch(`${baseUrl}/metrics`);

  const res = await fetch(`${baseUrl}/metrics`);
  const body = await res.json();

  assert.equal(body.requestCount, 4);
});

test('GET /metrics returns 405 for non-GET methods', async () => {
  const res = await fetch(`${baseUrl}/metrics`, { method: 'POST' });
  assert.equal(res.status, 405);
  assert.deepEqual(await res.json(), { error: 'Method Not Allowed' });
});
