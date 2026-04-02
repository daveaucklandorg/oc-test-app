import assert from 'node:assert/strict';
import test from 'node:test';

let server;
let baseUrl;

test.before(async () => {
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

test('GET /statusz2 returns probe response', async () => {
  const response = await fetch(`${baseUrl}/statusz2`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json');
  assert.deepEqual(await response.json(), { ok: true, service: 'oc-test-app', probe: 2 });
});
