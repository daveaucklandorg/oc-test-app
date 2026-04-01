import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

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
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  fs.rmSync(dbPath, { force: true });
});

test('GET / returns 200 with Settings link', async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.ok(body.includes('Settings'), 'should contain Settings link');
  assert.ok(body.includes('/settings'), 'should link to /settings');
});

test('GET /settings returns 200 with app name, port, db path', async () => {
  const res = await fetch(`${baseUrl}/settings`);
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.ok(body.includes('OC Test App'), 'should contain default app name');
  assert.ok(body.includes('Port:'), 'should contain port label');
  assert.ok(body.includes('Database Path:'), 'should contain db path label');
  assert.ok(body.includes('contacts.db'), 'should contain db filename');
});

test('POST /settings with valid app_name updates and reflects change', async () => {
  const postRes = await fetch(`${baseUrl}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_name: 'New App Name' }),
  });
  assert.equal(postRes.status, 200);
  const json = await postRes.json();
  assert.equal(json.app_name, 'New App Name');

  const getRes = await fetch(`${baseUrl}/settings`);
  const body = await getRes.text();
  assert.ok(body.includes('New App Name'), 'settings page should reflect updated name');
});

test('POST /settings with empty app_name returns 400', async () => {
  const res = await fetch(`${baseUrl}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_name: '   ' }),
  });
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.error, 'app_name is required');
});

test('POST /settings with form-urlencoded redirects', async () => {
  const res = await fetch(`${baseUrl}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'app_name=Form+Name',
    redirect: 'manual',
  });
  assert.equal(res.status, 303);
  assert.ok(res.headers.get('location').includes('/settings'));
});
