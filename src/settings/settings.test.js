import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createSettingsStore } from './settingsDb.js';

test('settings store supports CRUD with a temporary SQLite file', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-test-app-settings-'));
  const dbPath = path.join(tempDir, 'settings-test.db');
  const store = createSettingsStore({ dbPath });

  try {
    assert.deepEqual(store.getAll(), []);
    assert.equal(store.getByKey('theme'), null);

    const created = store.upsert('theme', 'dark');
    assert.deepEqual(created, { key: 'theme', value: 'dark' });
    assert.deepEqual(store.getByKey('theme'), { key: 'theme', value: 'dark' });
    assert.deepEqual(store.getAll(), [{ key: 'theme', value: 'dark' }]);

    const updated = store.upsert('theme', 'light');
    assert.deepEqual(updated, { key: 'theme', value: 'light' });
    assert.deepEqual(store.getAll(), [{ key: 'theme', value: 'light' }]);

    assert.equal(store.deleteByKey('theme'), true);
    assert.equal(store.getByKey('theme'), null);
    assert.deepEqual(store.getAll(), []);
    assert.equal(store.deleteByKey('theme'), false);
  } finally {
    store.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('settings store validates required key and string value', () => {
  const store = createSettingsStore({ dbPath: ':memory:' });

  try {
    assert.throws(() => store.getByKey('   '), /key is required/);
    assert.throws(() => store.upsert('', 'value'), /key is required/);
    assert.throws(() => store.upsert('theme', 123), /value must be a string/);
  } finally {
    store.close();
  }
});
