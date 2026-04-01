import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp } from '../server.js';
import { createRateLimiter } from './rateLimiter.js';

async function startTestServer(rateLimiter) {
  const server = createApp({ rateLimiter });

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    server,
    baseUrl,
    async close() {
      rateLimiter.stopCleanup();
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
  };
}

test('allows up to 100 requests within the window', async () => {
  const rateLimiter = createRateLimiter();
  const app = await startTestServer(rateLimiter);

  try {
    for (let index = 0; index < 100; index += 1) {
      const response = await fetch(`${app.baseUrl}/api/health`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { status: 'ok' });
    }
  } finally {
    await app.close();
  }
});

test('returns 429 on the 101st request within the same window', async () => {
  const rateLimiter = createRateLimiter();
  const app = await startTestServer(rateLimiter);

  try {
    for (let index = 0; index < 100; index += 1) {
      const response = await fetch(`${app.baseUrl}/api/health`);
      assert.equal(response.status, 200);
      await response.arrayBuffer();
    }

    const response = await fetch(`${app.baseUrl}/api/health`);
    assert.equal(response.status, 429);
    assert.deepEqual(await response.json(), { error: 'Too Many Requests' });
  } finally {
    await app.close();
  }
});

test('includes Retry-After header on rate-limited responses', async () => {
  const rateLimiter = createRateLimiter();
  const app = await startTestServer(rateLimiter);

  try {
    for (let index = 0; index < 100; index += 1) {
      const response = await fetch(`${app.baseUrl}/api/health`);
      assert.equal(response.status, 200);
      await response.arrayBuffer();
    }

    const response = await fetch(`${app.baseUrl}/api/health`);
    assert.equal(response.status, 429);
    assert.ok(response.headers.get('retry-after'));
  } finally {
    await app.close();
  }
});

test('allows requests again after the window resets', async () => {
  let currentTime = 0;
  const rateLimiter = createRateLimiter({ now: () => currentTime });
  const app = await startTestServer(rateLimiter);

  try {
    for (let index = 0; index < 100; index += 1) {
      const response = await fetch(`${app.baseUrl}/api/health`);
      assert.equal(response.status, 200);
      await response.arrayBuffer();
    }

    let response = await fetch(`${app.baseUrl}/api/health`);
    assert.equal(response.status, 429);

    currentTime += 60_001;

    response = await fetch(`${app.baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  } finally {
    await app.close();
  }
});
