import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp } from './server.js';

let server;
let baseUrl;

test.before(async () => {
  server = createApp();

  await new Promise((resolve) => {
    server.listen(0, () => {
      resolve();
    });
  });

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
});

test('GET /ready returns ready=true JSON', async () => {
  const response = await fetch(`${baseUrl}/ready`);

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /^application\/json(?:;|$)/);
  assert.deepEqual(await response.json(), { ready: true });
});
