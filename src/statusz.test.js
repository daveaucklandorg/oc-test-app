import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './server.js';

describe('GET /statusz', () => {
  const server = createApp();

  after(() => new Promise((resolve) => server.close(resolve)));

  it('returns 200 with health payload', async () => {
    await new Promise((resolve) => server.listen(0, resolve));
    const { port } = server.address();

    const res = await fetch(`http://127.0.0.1:${port}/statusz`);

    assert.equal(res.status, 200);
    assert.ok(res.headers.get('content-type').includes('application/json'));
    assert.deepStrictEqual(await res.json(), { ok: true, service: 'oc-test-app' });
  });
});
