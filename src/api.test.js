import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-test-app-'));
const dbPath = path.join(tempDir, 'contacts.test.db');

process.env.CONTACTS_DB_PATH = dbPath;

const { createServer } = await import('./server.js');

let server;
let baseUrl;

test.before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('API contact lifecycle works end-to-end', async () => {
  const healthResponse = await fetch(`${baseUrl}/api/health`);
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), { status: 'ok' });

  const createPayload = {
    name: 'Alice Example',
    email: 'alice@example.com',
    phone: '123-456-7890',
  };

  const createResponse = await fetch(`${baseUrl}/api/contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(createPayload),
  });
  assert.equal(createResponse.status, 201);

  const createdContact = await createResponse.json();
  assert.equal(createdContact.name, createPayload.name);
  assert.equal(createdContact.email, createPayload.email);
  assert.equal(createdContact.phone, createPayload.phone);
  assert.equal(typeof createdContact.id, 'number');

  const listResponse = await fetch(`${baseUrl}/api/contacts`);
  assert.equal(listResponse.status, 200);

  const listedContacts = await listResponse.json();
  assert.ok(Array.isArray(listedContacts));
  assert.ok(listedContacts.some((contact) => contact.id === createdContact.id && contact.name === createPayload.name));

  const getResponse = await fetch(`${baseUrl}/api/contacts/${createdContact.id}`);
  assert.equal(getResponse.status, 200);
  assert.deepEqual(await getResponse.json(), createdContact);

  const updatePayload = {
    name: 'Alice Updated',
    email: 'alice.updated@example.com',
    phone: '999-555-1212',
  };

  const updateResponse = await fetch(`${baseUrl}/api/contacts/${createdContact.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatePayload),
  });
  assert.equal(updateResponse.status, 200);

  const updatedContact = await updateResponse.json();
  assert.equal(updatedContact.id, createdContact.id);
  assert.equal(updatedContact.name, updatePayload.name);
  assert.equal(updatedContact.email, updatePayload.email);
  assert.equal(updatedContact.phone, updatePayload.phone);

  const deleteResponse = await fetch(`${baseUrl}/api/contacts/${createdContact.id}`, {
    method: 'DELETE',
  });
  assert.equal(deleteResponse.status, 204);
  assert.equal(await deleteResponse.text(), '');

  const missingResponse = await fetch(`${baseUrl}/api/contacts/${createdContact.id}`);
  assert.equal(missingResponse.status, 404);
  assert.deepEqual(await missingResponse.json(), { error: 'contact not found' });
});
