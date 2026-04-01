import assert from 'node:assert/strict';
import test from 'node:test';

let server;
let baseUrl;

test.before(async () => {
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
});

test('GET /ping returns plain-text pong', async () => {
  const response = await fetch(`${baseUrl}/ping`);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/plain');
  assert.equal(await response.text(), 'pong');
});
