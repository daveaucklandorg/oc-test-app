import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

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

test('GET /build-info returns build information', async () => {
  const response = await fetch(`${baseUrl}/build-info`);

  assert.equal(response.status, 200);
  assert.ok(response.headers.get('content-type').includes('application/json'));

  const body = await response.json();

  assert.equal(typeof body.version, 'string');
  assert.equal(typeof body.nodeVersion, 'string');
  assert.equal(typeof body.platform, 'string');
  assert.equal(typeof body.arch, 'string');
  assert.equal(typeof body.uptime, 'number');
  assert.equal(typeof body.timestamp, 'string');

  assert.equal(body.version, pkg.version);
  assert.equal(body.nodeVersion, process.version);
});
