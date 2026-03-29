import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-test-app-'));
process.env.CONTACTS_DB_PATH = path.join(tempDir, 'contacts.db');

const { createServer } = await import('./server.js');

test('contact API supports health and CRUD flows', async (t) => {
  const server = createServer();

  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const healthResponse = await fetch(`${baseUrl}/api/health`);
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), { status: 'ok' });

  const createResponse = await fetch(`${baseUrl}/api/contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '123-456',
    }),
  });
  assert.equal(createResponse.status, 201);
  const createdContact = await createResponse.json();
  assert.equal(createdContact.name, 'Ada Lovelace');

  const listResponse = await fetch(`${baseUrl}/api/contacts`);
  assert.equal(listResponse.status, 200);
  const contacts = await listResponse.json();
  assert.ok(contacts.some((contact) => contact.id === createdContact.id && contact.name === 'Ada Lovelace'));

  const getResponse = await fetch(`${baseUrl}/api/contacts/${createdContact.id}`);
  assert.equal(getResponse.status, 200);
  assert.equal((await getResponse.json()).email, 'ada@example.com');

  const updateResponse = await fetch(`${baseUrl}/api/contacts/${createdContact.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Ada Byron',
      email: 'ada.byron@example.com',
      phone: '555-0100',
    }),
  });
  assert.equal(updateResponse.status, 200);
  assert.equal((await updateResponse.json()).name, 'Ada Byron');

  const deleteResponse = await fetch(`${baseUrl}/api/contacts/${createdContact.id}`, {
    method: 'DELETE',
  });
  assert.equal(deleteResponse.status, 204);

  const deletedResponse = await fetch(`${baseUrl}/api/contacts/${createdContact.id}`);
  assert.equal(deletedResponse.status, 404);
});


test('non-api routes serve the frontend', async (t) => {
  const server = createServer();

  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/contacts`);

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /text\/html/);
  assert.match(await response.text(), /Contact Book/);
});
