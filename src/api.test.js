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

async function createContact(body, headers = { 'Content-Type': 'application/json' }) {
  return fetch(`${baseUrl}/api/contacts`, {
    method: 'POST',
    headers,
    body,
  });
}

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

  const createResponse = await createContact(
    JSON.stringify({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '123-456-7890',
    })
  );
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

test('POST /api/contacts accepts valid name and description', async () => {
  const response = await createContact(
    JSON.stringify({
      name: 'Grace Hopper',
      description: 'Pioneer of computer programming.',
    })
  );

  assert.equal(response.status, 201);
  assert.equal(response.headers.get('content-type'), 'application/json');

  const body = await response.json();
  assert.equal(body.name, 'Grace Hopper');
  assert.ok(body.id);
});

test('POST /api/contacts accepts valid name without description', async () => {
  const response = await createContact(
    JSON.stringify({
      name: 'Katherine Johnson',
    })
  );

  assert.equal(response.status, 201);
  assert.equal(response.headers.get('content-type'), 'application/json');

  const body = await response.json();
  assert.equal(body.name, 'Katherine Johnson');
  assert.ok(body.id);
});

test('POST /api/contacts rejects missing name', async () => {
  const response = await createContact(JSON.stringify({ description: 'Missing name' }));

  assert.equal(response.status, 400);
  assert.equal(response.headers.get('content-type'), 'application/json');
  assert.deepEqual(await response.json(), {
    error: 'name is required and must be a string (max 100 characters)',
  });
});

test('POST /api/contacts rejects non-string name', async () => {
  const response = await createContact(JSON.stringify({ name: 42 }));

  assert.equal(response.status, 400);
  assert.equal(response.headers.get('content-type'), 'application/json');
  assert.deepEqual(await response.json(), {
    error: 'name is required and must be a string (max 100 characters)',
  });
});

test('POST /api/contacts rejects name longer than 100 characters', async () => {
  const response = await createContact(JSON.stringify({ name: 'a'.repeat(101) }));

  assert.equal(response.status, 400);
  assert.equal(response.headers.get('content-type'), 'application/json');
  assert.deepEqual(await response.json(), {
    error: 'name is required and must be a string (max 100 characters)',
  });
});

test('POST /api/contacts rejects non-string description', async () => {
  const response = await createContact(
    JSON.stringify({
      name: 'Margaret Hamilton',
      description: 123,
    })
  );

  assert.equal(response.status, 400);
  assert.equal(response.headers.get('content-type'), 'application/json');
  assert.deepEqual(await response.json(), {
    error: 'description must be a string (max 500 characters)',
  });
});

test('POST /api/contacts rejects description longer than 500 characters', async () => {
  const response = await createContact(
    JSON.stringify({
      name: 'Margaret Hamilton',
      description: 'd'.repeat(501),
    })
  );

  assert.equal(response.status, 400);
  assert.equal(response.headers.get('content-type'), 'application/json');
  assert.deepEqual(await response.json(), {
    error: 'description must be a string (max 500 characters)',
  });
});

test('POST /api/contacts rejects malformed JSON', async () => {
  const response = await createContact('{"name":', { 'Content-Type': 'application/json' });

  assert.equal(response.status, 400);
  assert.equal(response.headers.get('content-type'), 'application/json');
  assert.deepEqual(await response.json(), { error: 'Invalid JSON body' });
});

test('POST /api/health returns 405 with Allow header', async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET');
  assert.equal(response.headers.get('content-type'), 'application/json');
  assert.deepEqual(await response.json(), { error: 'Method not allowed' });
});
