import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp } from './server.js';

let server;
let baseUrl;

test.before(async () => {
  server = createApp();

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  if (!server) {
    return;
  }

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
});

test('GET /health returns JSON ok status with current ISO timestamp', async () => {
  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}/health`);
  const endedAt = Date.now();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json');

  const body = await response.json();
  assert.equal(body.status, 'ok');
  assert.equal(typeof body.timestamp, 'string');

  const timestampMs = Date.parse(body.timestamp);
  assert.notEqual(Number.isNaN(timestampMs), true);
  assert.equal(new Date(timestampMs).toISOString(), body.timestamp);
  assert.ok(timestampMs >= startedAt - 1000);
  assert.ok(timestampMs <= endedAt + 1000);
});
