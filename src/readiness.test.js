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

test('GET /readiness returns 200 with correct structure', async () => {
  const res = await fetch(`${baseUrl}/readiness`);

  assert.equal(res.status, 200);
  assert.ok(res.headers.get('content-type').includes('application/json'));

  const body = await res.json();

  assert.equal(body.status, 'ready');
  assert.ok(body.checks);
  assert.ok(body.timestamp);
  assert.equal(body.checks.sqlite.status, 'ok');
  assert.equal(typeof body.checks.sqlite.latencyMs, 'number');
});
