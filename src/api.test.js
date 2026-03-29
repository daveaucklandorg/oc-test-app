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
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  fs.rmSync(dbPath, { force: true });
});

test('API contact lifecycle', async () => {
  const healthResponse = await fetch(`${baseUrl}/api/health`);
  assert.equal(healthResponse.status, 200);
  assert.equal(healthResponse.headers.get('content-type'), 'application/json');
  assert.deepEqual(await healthResponse.json(), { status: 'ok' });

  const createResponse = await fetch(`${baseUrl}/api/contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '123-456-7890',
    }),
  });
  assert.equal(createResponse.status, 201);
  const createdContact = await createResponse.json();
  assert.equal(createdContact.name, 'Ada Lovelace');
  assert.equal(createdContact.email, 'ada@example.com');
  assert.equal(createdContact.phone, '123-456-7890');
  assert.ok(createdContact.id);

  const listResponse = await fetch(`${baseUrl}/api/contacts`);
  assert.equal(listResponse.status, 200);
  const contacts = await listResponse.json();
  assert.ok(contacts.some((contact) => contact.id === createdContact.id));

  const getResponse = await fetch(`${baseUrl}/api/contacts/${createdContact.id}`);
  assert.equal(getResponse.status, 200);
  assert.deepEqual(await getResponse.json(), createdContact);

  const updateResponse = await fetch(`${baseUrl}/api/contacts/${createdContact.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Ada King',
      email: 'ada.king@example.com',
      phone: '555-0000',
    }),
  });
  assert.equal(updateResponse.status, 200);
  const updatedContact = await updateResponse.json();
  assert.equal(updatedContact.id, createdContact.id);
  assert.equal(updatedContact.name, 'Ada King');
  assert.equal(updatedContact.email, 'ada.king@example.com');
  assert.equal(updatedContact.phone, '555-0000');

  const deleteResponse = await fetch(`${baseUrl}/api/contacts/${createdContact.id}`, {
    method: 'DELETE',
  });
  assert.equal(deleteResponse.status, 204);
  assert.equal(await deleteResponse.text(), '');

  const deletedGetResponse = await fetch(`${baseUrl}/api/contacts/${createdContact.id}`);
  assert.equal(deletedGetResponse.status, 404);
  assert.deepEqual(await deletedGetResponse.json(), { error: 'Not Found' });
});
