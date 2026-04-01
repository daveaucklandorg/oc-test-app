import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'contacts.db');

fs.mkdirSync(dataDir, { recursive: true });

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

function normalizeOptionalString(value, fieldName) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string if provided`);
  }

  return value;
}

function normalizeDescription(description) {
  if (description === undefined || description === null) {
    return null;
  }

  if (typeof description !== 'string' || description.length > 500) {
    throw new Error('description must be a string (max 500 characters)');
  }

  return description;
}

function normalizeContactInput({ name, email = null, phone = null, description = null } = {}) {
  if (typeof name !== 'string') {
    throw new Error('name is required and must be a string (max 100 characters)');
  }

  const normalizedName = name.trim();

  if (!normalizedName || normalizedName.length > 100) {
    throw new Error('name is required and must be a string (max 100 characters)');
  }

  normalizeDescription(description);

  return {
    name: normalizedName,
    email: normalizeOptionalString(email, 'email'),
    phone: normalizeOptionalString(phone, 'phone'),
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
