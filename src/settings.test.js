import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const settingsDbPath = path.resolve(__dirname, '..', 'data', 'settings.db');

let server;
let baseUrl;
let dbModule;

function closeServer(currentServer) {
  if (!currentServer) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    currentServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

test.before(async () => {
  fs.rmSync(settingsDbPath, { force: true });

  dbModule = await import('./db.js');
  const { startServer } = await import('./server.js');
  server = await startServer(0);

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  await closeServer(server);
  fs.rmSync(settingsDbPath, { force: true });
});

test('settings table is created on initialization', () => {
  assert.equal(fs.existsSync(settingsDbPath), true);

  const sqlite = new Database(settingsDbPath, { readonly: true });
  const table = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'settings'")
    .get();

  sqlite.close();

  assert.deepEqual(table, { name: 'settings' });
});

test('settings db helpers support CRUD with upsert behavior', () => {
  const { deleteSetting, getAllSettings, getSetting, upsertSetting } = dbModule;

  deleteSetting('theme');

  const created = upsertSetting('theme', 'dark');
  assert.equal(created.created, true);
  assert.deepEqual(created.setting, { key: 'theme', value: 'dark' });
  assert.deepEqual(getSetting('theme'), { key: 'theme', value: 'dark' });

  const updated = upsertSetting('theme', 'light');
  assert.equal(updated.created, false);
  assert.deepEqual(updated.setting, { key: 'theme', value: 'light' });
  assert.deepEqual(getAllSettings().find((setting) => setting.key === 'theme'), {
    key: 'theme',
    value: 'light',
  });

  assert.equal(deleteSetting('theme'), true);
  assert.equal(getSetting('theme'), null);
  assert.equal(deleteSetting('theme'), false);
});

test('settings API and HTML page work', async () => {
  await fetch(`${baseUrl}/api/settings/test-key`, { method: 'DELETE' });

  const pageResponse = await fetch(`${baseUrl}/settings`);
  assert.equal(pageResponse.status, 200);
  assert.match(pageResponse.headers.get('content-type') ?? '', /^text\/html/);
  const pageHtml = await pageResponse.text();
  assert.match(pageHtml, /<h1>Settings<\/h1>/);
  assert.match(pageHtml, /Manage key-value settings stored in SQLite/);

  const missingResponse = await fetch(`${baseUrl}/api/settings/test-key`);
  assert.equal(missingResponse.status, 404);
  assert.deepEqual(await missingResponse.json(), { error: 'Not Found' });

  const invalidResponse = await fetch(`${baseUrl}/api/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: 'missing-key' }),
  });
  assert.equal(invalidResponse.status, 400);
  assert.deepEqual(await invalidResponse.json(), { error: 'key is required' });

  const createResponse = await fetch(`${baseUrl}/api/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'test-key', value: 'first-value' }),
  });
  assert.equal(createResponse.status, 201);
  assert.deepEqual(await createResponse.json(), { key: 'test-key', value: 'first-value' });

  const getResponse = await fetch(`${baseUrl}/api/settings/test-key`);
  assert.equal(getResponse.status, 200);
  assert.deepEqual(await getResponse.json(), { key: 'test-key', value: 'first-value' });

  const listResponse = await fetch(`${baseUrl}/api/settings`);
  assert.equal(listResponse.status, 200);
  assert.ok((await listResponse.json()).some((setting) => setting.key === 'test-key' && setting.value === 'first-value'));

  const updateResponse = await fetch(`${baseUrl}/api/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'test-key', value: 'updated-value' }),
  });
  assert.equal(updateResponse.status, 200);
  assert.deepEqual(await updateResponse.json(), { key: 'test-key', value: 'updated-value' });

  const deleteResponse = await fetch(`${baseUrl}/api/settings/test-key`, { method: 'DELETE' });
  assert.equal(deleteResponse.status, 204);
  assert.equal(await deleteResponse.text(), '');

  const deletedResponse = await fetch(`${baseUrl}/api/settings/test-key`);
  assert.equal(deletedResponse.status, 404);
  assert.deepEqual(await deletedResponse.json(), { error: 'Not Found' });
});
