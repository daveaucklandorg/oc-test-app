import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, '..', 'data');
const contactsDbPath = path.join(dataDir, 'contacts.db');
const settingsDbPath = path.join(dataDir, 'settings.db');

fs.mkdirSync(dataDir, { recursive: true });

const contactsDb = new Database(contactsDbPath);
const settingsDb = new Database(settingsDbPath);

contactsDb.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

settingsDb.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`);

const selectAllStmt = contactsDb.prepare(`
  SELECT id, name, email, phone, created_at
  FROM contacts
  ORDER BY id ASC
`);

const selectByIdStmt = contactsDb.prepare(`
  SELECT id, name, email, phone, created_at
  FROM contacts
  WHERE id = ?
`);

const insertStmt = contactsDb.prepare(`
  INSERT INTO contacts (name, email, phone)
  VALUES (@name, @email, @phone)
`);

const updateStmt = contactsDb.prepare(`
  UPDATE contacts
  SET name = @name,
      email = @email,
      phone = @phone
  WHERE id = @id
`);

const deleteStmt = contactsDb.prepare(`
  DELETE FROM contacts
  WHERE id = ?
`);

const selectAllSettingsStmt = settingsDb.prepare(`
  SELECT key, value
  FROM settings
  ORDER BY key ASC
`);

const selectSettingStmt = settingsDb.prepare(`
  SELECT key, value
  FROM settings
  WHERE key = ?
`);

const upsertSettingStmt = settingsDb.prepare(`
  INSERT INTO settings (key, value)
  VALUES (@key, @value)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

const deleteSettingStmt = settingsDb.prepare(`
  DELETE FROM settings
  WHERE key = ?
`);

function normalizeContactInput({ name, email = null, phone = null } = {}) {
  const normalizedName = typeof name === 'string' ? name.trim() : '';

  if (!normalizedName) {
    throw new Error('name is required');
  }

  return {
    name: normalizedName,
    email: email ?? null,
    phone: phone ?? null,
  };
}

function normalizeSettingInput(key, value) {
  const normalizedKey = typeof key === 'string' ? key.trim() : '';

  if (!normalizedKey) {
    throw new Error('key is required');
  }

  return {
    key: normalizedKey,
    value: value == null ? '' : String(value),
  };
}

export function getAll() {
  return selectAllStmt.all();
}

export function getById(id) {
  return selectByIdStmt.get(id) ?? null;
}

export function create(contact) {
  const values = normalizeContactInput(contact);
  const result = insertStmt.run(values);

  return getById(result.lastInsertRowid);
}

export function update(id, contact) {
  const values = normalizeContactInput(contact);
  const result = updateStmt.run({ id, ...values });

  if (result.changes === 0) {
    return null;
  }

  return getById(id);
}

export function deleteById(id) {
  const result = deleteStmt.run(id);
  return result.changes > 0;
}

export function getAllSettings() {
  return selectAllSettingsStmt.all();
}

export function getSetting(key) {
  return selectSettingStmt.get(key) ?? null;
}

export function upsertSetting(key, value) {
  const normalized = normalizeSettingInput(key, value);
  const existed = Boolean(getSetting(normalized.key));

  upsertSettingStmt.run(normalized);

  return {
    setting: getSetting(normalized.key),
    created: !existed,
  };
}

export function deleteSetting(key) {
  const result = deleteSettingStmt.run(key);
  return result.changes > 0;
}

export { contactsDbPath, settingsDbPath };
