import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultDataDir = path.resolve(__dirname, '..', 'data');
const configuredDbPath = process.env.CONTACTS_DB_PATH;
const dbPath = configuredDbPath ?? path.join(defaultDataDir, 'contacts.db');
const dbDir = path.dirname(dbPath);

fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const selectAllStmt = db.prepare(`
  SELECT id, name, email, phone, created_at
  FROM contacts
  ORDER BY id ASC
`);

const selectByIdStmt = db.prepare(`
  SELECT id, name, email, phone, created_at
  FROM contacts
  WHERE id = ?
`);

const insertStmt = db.prepare(`
  INSERT INTO contacts (name, email, phone)
  VALUES (@name, @email, @phone)
`);

const updateStmt = db.prepare(`
  UPDATE contacts
  SET name = @name,
      email = @email,
      phone = @phone
  WHERE id = @id
`);

const deleteStmt = db.prepare(`
  DELETE FROM contacts
  WHERE id = ?
`);

function normalizeOptionalText(value) {
  return typeof value === 'string' ? value.trim() : value ?? null;
}

function normalizeContactInput({ name, email = null, phone = null } = {}) {
  const normalizedName = typeof name === 'string' ? name.trim() : '';

  if (!normalizedName) {
    throw new Error('name is required');
  }

  return {
    name: normalizedName,
    email: normalizeOptionalText(email),
    phone: normalizeOptionalText(phone),
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
