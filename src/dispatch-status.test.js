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
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('GET /dispatch-status returns expected payload', async () => {
  const response = await fetch(`${baseUrl}/dispatch-status`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json');

  const body = await response.json();

  assert.ok('service' in body, 'body should contain service');
  assert.ok('dispatchBridge' in body, 'body should contain dispatchBridge');
  assert.ok('ticket' in body, 'body should contain ticket');
  assert.ok('timestamp' in body, 'body should contain timestamp');

  assert.equal(body.service, 'oc-test-app');
  assert.equal(body.dispatchBridge, 'active');
  assert.equal(body.ticket, 'E2E-62');
  assert.ok(!isNaN(Date.parse(body.timestamp)), 'timestamp should be a valid ISO string');
});
