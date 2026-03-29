import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '..', 'data', 'contacts.db');

let server;
let baseUrl;
let createdContact;

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

test('health endpoint returns 200 with expected payload', async () => {
  const response = await fetch(`${baseUrl}/api/health`);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json');
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('create a contact via POST returns 201', async () => {
  const response = await fetch(`${baseUrl}/api/contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '123-456-7890',
    }),
  });

  assert.equal(response.status, 201);
  assert.equal(response.headers.get('content-type'), 'application/json');

  createdContact = await response.json();
  assert.equal(createdContact.name, 'Ada Lovelace');
  assert.equal(createdContact.email, 'ada@example.com');
  assert.equal(createdContact.phone, '123-456-7890');
  assert.ok(createdContact.id);
});

test('list contacts includes the created contact', async () => {
  const response = await fetch(`${baseUrl}/api/contacts`);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json');

  const contacts = await response.json();
  assert.ok(contacts.some((contact) => contact.id === createdContact.id));
});

test('get contact by ID returns 200 with correct data', async () => {
  const response = await fetch(`${baseUrl}/api/contacts/${createdContact.id}`);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json');
  assert.deepEqual(await response.json(), createdContact);
});

test('update contact via PUT returns 200 with updated data', async () => {
  const response = await fetch(`${baseUrl}/api/contacts/${createdContact.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Ada King',
      email: 'ada.king@example.com',
      phone: '555-0000',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json');

  createdContact = await response.json();
  assert.equal(createdContact.name, 'Ada King');
  assert.equal(createdContact.email, 'ada.king@example.com');
  assert.equal(createdContact.phone, '555-0000');
});

test('delete contact via DELETE returns 204', async () => {
  const response = await fetch(`${baseUrl}/api/contacts/${createdContact.id}`, {
    method: 'DELETE',
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('content-type'), 'application/json');
  assert.equal(await response.text(), '');
});

test('get deleted contact returns 404', async () => {
  const response = await fetch(`${baseUrl}/api/contacts/${createdContact.id}`);

  assert.equal(response.status, 404);
  assert.equal(response.headers.get('content-type'), 'application/json');
  assert.deepEqual(await response.json(), { error: 'Not Found' });
});
