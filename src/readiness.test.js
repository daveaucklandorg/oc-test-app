import assert from 'node:assert/strict';
import test from 'node:test';

import { createRouter } from './router.js';
import { createApp } from './server.js';

async function withServer(database, run) {
  const app = createApp({ router: createRouter({ database }) });

  await new Promise((resolve) => {
    app.listen(0, () => resolve());
  });

  const address = app.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      app.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

test('GET /readiness returns ok when database query succeeds', async () => {
  const database = {
    prepare(sql) {
      assert.equal(sql, 'SELECT 1');
      return {
        get() {
          return { 1: 1 };
        },
      };
    },
  };

  await withServer(database, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/readiness`);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/json');
    assert.deepEqual(await response.json(), { status: 'ok', checks: { db: 'ok' } });
  });
});

test('GET /readiness returns degraded when database query fails', async () => {
  const database = {
    prepare() {
      throw new Error('database unavailable');
    },
  };

  await withServer(database, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/readiness`);

    assert.equal(response.status, 503);
    assert.equal(response.headers.get('content-type'), 'application/json');
    assert.deepEqual(await response.json(), {
      status: 'degraded',
      checks: { db: 'database unavailable' },
    });
  });
});
