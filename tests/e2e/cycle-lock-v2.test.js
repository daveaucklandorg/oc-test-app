/**
 * Cycle Lock v2 — E2E proof-of-concept (Ticket #191)
 *
 * Demonstrates what happens when two triggers (HTTP requests) fire
 * simultaneously against the oc-test-app CRUD API.
 *
 * Finding: No application-level cycle lock exists. SQLite + better-sqlite3
 * provides implicit serialisation within a single process, but no
 * deduplication, optimistic locking, or concurrent-execution prevention.
 *
 * Run: node --test tests/e2e/cycle-lock-v2.test.js
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '..', '..', 'data', 'contacts.db');

let server;
let baseUrl;

test.before(async () => {
  // Clean slate
  fs.rmSync(dbPath, { force: true });

  const { createApp } = await import('../../src/server.js');
  server = createApp();

  await new Promise((resolve) => {
    server.listen(0, () => resolve());
  });

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
  fs.rmSync(dbPath, { force: true });
});

// Helper: create a contact
async function createContact(name) {
  const res = await fetch(`${baseUrl}/api/contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email: `${name.toLowerCase().replace(/\s/g, '.')}@test.com` }),
  });
  return { status: res.status, body: await res.json() };
}

test('Simultaneous POST — both succeed, no deduplication (no cycle lock)', async () => {
  // Fire two POSTs at the same time with identical data
  const [r1, r2] = await Promise.all([
    createContact('Duplicate Test'),
    createContact('Duplicate Test'),
  ]);

  assert.equal(r1.status, 201, 'First POST should succeed');
  assert.equal(r2.status, 201, 'Second POST should also succeed');
  assert.notEqual(r1.body.id, r2.body.id, 'Should create two distinct records (no dedup)');

  // Verify both exist
  const listRes = await fetch(`${baseUrl}/api/contacts`);
  const contacts = await listRes.json();
  const dupes = contacts.filter((c) => c.name === 'Duplicate Test');
  assert.equal(dupes.length, 2, 'Both duplicates should exist — no cycle lock prevented this');
});

test('Simultaneous DELETE — exactly one succeeds, one gets 404 (implicit serialisation)', async () => {
  // Create a contact to delete
  const { body: contact } = await createContact('Delete Target');

  // Fire two DELETEs simultaneously on the same ID
  const [r1, r2] = await Promise.all([
    fetch(`${baseUrl}/api/contacts/${contact.id}`, { method: 'DELETE' }),
    fetch(`${baseUrl}/api/contacts/${contact.id}`, { method: 'DELETE' }),
  ]);

  const statuses = [r1.status, r2.status].sort();
  assert.deepEqual(statuses, [204, 404], 'One should succeed (204), one should find nothing (404)');
});

test('Simultaneous PUT — last writer wins, no conflict detection', async () => {
  // Create a contact to update
  const { body: contact } = await createContact('Update Target');

  // Fire two PUTs simultaneously with different data
  const [r1, r2] = await Promise.all([
    fetch(`${baseUrl}/api/contacts/${contact.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Writer A', email: 'a@test.com' }),
    }),
    fetch(`${baseUrl}/api/contacts/${contact.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Writer B', email: 'b@test.com' }),
    }),
  ]);

  assert.equal(r1.status, 200, 'First PUT should succeed');
  assert.equal(r2.status, 200, 'Second PUT should also succeed');

  // Check final state — should be one of the two writers
  const getRes = await fetch(`${baseUrl}/api/contacts/${contact.id}`);
  const final = await getRes.json();
  assert.ok(
    ['Writer A', 'Writer B'].includes(final.name),
    `Final name should be one of the writers, got: ${final.name}`
  );

  // The key finding: no error, no conflict detection — last writer wins silently
});
