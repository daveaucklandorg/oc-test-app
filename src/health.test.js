import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '..', 'data', 'contacts.db');

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

let server;
let baseUrl;

test.before(async () => {
  fs.rmSync(dbPath, { force: true });

  const { createApp } = await import('./server.js');
  server = createApp();

  await new Promise((resolve) => {
    server.listen(0, () => resolve());
  });

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});

test('GET /health returns 200 with status, uptime, and version', async () => {
  const res = await fetch(`${baseUrl}/health`);

  assert.equal(res.status, 200);
  assert.ok(res.headers.get('content-type').includes('application/json'));

  const body = await res.json();

  assert.equal(body.status, 'ok');
  assert.equal(typeof body.uptime, 'number');
  assert.ok(body.uptime > 0, 'uptime should be greater than 0');
  assert.equal(body.version, pkg.version);

  // Ensure no extra keys
  const keys = Object.keys(body).sort();
  assert.deepEqual(keys, ['status', 'uptime', 'version']);
});
