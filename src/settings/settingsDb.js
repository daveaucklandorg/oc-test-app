import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultDataDir = path.resolve(__dirname, '..', '..', 'data');
const defaultDbPath = process.env.APP_DB_PATH || path.join(defaultDataDir, 'contacts.db');

function normalizeKey(key) {
  const normalizedKey = typeof key === 'string' ? key.trim() : '';

  if (!normalizedKey) {
    throw new Error('key is required');
  }

  return normalizedKey;
}

function normalizeValue(value) {
  if (typeof value !== 'string') {
    throw new Error('value must be a string');
  }

  return value;
}

export function createSettingsStore({ dbPath = defaultDbPath } = {}) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  const selectAllStmt = db.prepare(`
    SELECT key, value
    FROM settings
    ORDER BY key ASC
  `);

  const selectByKeyStmt = db.prepare(`
    SELECT key, value
    FROM settings
    WHERE key = ?
  `);

  const upsertStmt = db.prepare(`
    INSERT INTO settings (key, value)
    VALUES (@key, @value)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);

  const deleteStmt = db.prepare(`
    DELETE FROM settings
    WHERE key = ?
  `);

  return {
    getAll() {
      return selectAllStmt.all();
    },

    getByKey(key) {
      return selectByKeyStmt.get(normalizeKey(key)) ?? null;
    },

    upsert(key, value) {
      const normalizedKey = normalizeKey(key);
      const normalizedValue = normalizeValue(value);

      upsertStmt.run({ key: normalizedKey, value: normalizedValue });
      return selectByKeyStmt.get(normalizedKey);
    },

    deleteByKey(key) {
      const result = deleteStmt.run(normalizeKey(key));
      return result.changes > 0;
    },

    close() {
      db.close();
    },
  };
}

const settingsStore = createSettingsStore();

export function getAll() {
  return settingsStore.getAll();
}

export function getByKey(key) {
  return settingsStore.getByKey(key);
}

export function upsert(key, value) {
  return settingsStore.upsert(key, value);
}

export function deleteByKey(key) {
  return settingsStore.deleteByKey(key);
}
