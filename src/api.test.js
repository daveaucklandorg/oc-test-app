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

async function createContact(overrides = {}) {
  const response = await fetch(`${baseUrl}/api/contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '123-456-7890',
      ...overrides,
    }),
  });

  assert.equal(response.status, 201);
  return response.json();
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

test('API contact lifecycle and paginated list responses', async () => {
  const healthResponse = await fetch(`${baseUrl}/api/health`);
  assert.equal(healthResponse.status, 200);
  assert.equal(healthResponse.headers.get('content-type'), 'application/json');
  assert.deepEqual(await healthResponse.json(), { status: 'ok' });

  const createdContacts = [];

  for (let index = 1; index <= 25; index += 1) {
    const contact = await createContact({
      name: `Contact ${index}`,
      email: `contact${index}@example.com`,
      phone: `555-00${String(index).padStart(2, '0')}`,
    });
    createdContacts.push(contact);
  }

  const listResponse = await fetch(`${baseUrl}/api/contacts`);
  assert.equal(listResponse.status, 200);
  assert.equal(listResponse.headers.get('content-type'), 'application/json');
  assert.match(listResponse.headers.get('link'), /rel="first"/);
  assert.match(listResponse.headers.get('link'), /rel="last"/);
  assert.match(listResponse.headers.get('link'), /rel="next"/);
  assert.doesNotMatch(listResponse.headers.get('link'), /rel="prev"/);

  const listPayload = await listResponse.json();
  assert.equal(listPayload.pagination.total, 25);
  assert.equal(listPayload.pagination.limit, 20);
  assert.equal(listPayload.pagination.offset, 0);
  assert.equal(listPayload.data.length, 20);
  assert.equal(listPayload.data[0].id, createdContacts[0].id);
  assert.equal(listPayload.data.at(-1).id, createdContacts[19].id);

  const customListResponse = await fetch(`${baseUrl}/api/contacts?limit=5&offset=20`);
  assert.equal(customListResponse.status, 200);
  const customLinkHeader = customListResponse.headers.get('link');
  assert.match(customLinkHeader, /rel="first"/);
  assert.match(customLinkHeader, /rel="last"/);
  assert.match(customLinkHeader, /rel="prev"/);
  assert.doesNotMatch(customLinkHeader, /rel="next"/);
  assert.match(customLinkHeader, /offset=15[^>]*>; rel="prev"/);
  assert.match(customLinkHeader, /offset=20[^>]*>; rel="last"/);

  const customPayload = await customListResponse.json();
  assert.equal(customPayload.pagination.total, 25);
  assert.equal(customPayload.pagination.limit, 5);
  assert.equal(customPayload.pagination.offset, 20);
  assert.equal(customPayload.data.length, 5);
  assert.deepEqual(
    customPayload.data.map((contact) => contact.id),
    createdContacts.slice(20).map((contact) => contact.id),
  );

  const oversizedLimitResponse = await fetch(`${baseUrl}/api/contacts?limit=200`);
  assert.equal(oversizedLimitResponse.status, 200);
  const oversizedLimitPayload = await oversizedLimitResponse.json();
  assert.equal(oversizedLimitPayload.pagination.limit, 100);
  assert.equal(oversizedLimitPayload.data.length, 25);
  assert.match(oversizedLimitResponse.headers.get('link'), /offset=0[^>]*>; rel="last"/);

  const beyondTotalResponse = await fetch(`${baseUrl}/api/contacts?limit=10&offset=999`);
  assert.equal(beyondTotalResponse.status, 200);
  const beyondTotalPayload = await beyondTotalResponse.json();
  assert.equal(beyondTotalPayload.pagination.total, 25);
  assert.equal(beyondTotalPayload.pagination.limit, 10);
  assert.equal(beyondTotalPayload.pagination.offset, 999);
  assert.deepEqual(beyondTotalPayload.data, []);
  assert.match(beyondTotalResponse.headers.get('link'), /rel="prev"/);
  assert.doesNotMatch(beyondTotalResponse.headers.get('link'), /rel="next"/);

  const invalidLimitResponse = await fetch(`${baseUrl}/api/contacts?limit=abc`);
  assert.equal(invalidLimitResponse.status, 400);
  assert.deepEqual(await invalidLimitResponse.json(), {
    error: 'limit must be a positive integer',
  });

  const negativeOffsetResponse = await fetch(`${baseUrl}/api/contacts?offset=-1`);
  assert.equal(negativeOffsetResponse.status, 400);
  assert.deepEqual(await negativeOffsetResponse.json(), {
    error: 'offset must be a non-negative integer',
  });

  const getResponse = await fetch(`${baseUrl}/api/contacts/${createdContacts[0].id}`);
  assert.equal(getResponse.status, 200);
  assert.deepEqual(await getResponse.json(), createdContacts[0]);

  const updateResponse = await fetch(`${baseUrl}/api/contacts/${createdContacts[0].id}`, {
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
  assert.equal(updatedContact.id, createdContacts[0].id);
  assert.equal(updatedContact.name, 'Ada King');
  assert.equal(updatedContact.email, 'ada.king@example.com');
  assert.equal(updatedContact.phone, '555-0000');

  const deleteResponse = await fetch(`${baseUrl}/api/contacts/${createdContacts[0].id}`, {
    method: 'DELETE',
  });
  assert.equal(deleteResponse.status, 204);
  assert.equal(await deleteResponse.text(), '');

  const deletedGetResponse = await fetch(`${baseUrl}/api/contacts/${createdContacts[0].id}`);
  assert.equal(deletedGetResponse.status, 404);
  assert.deepEqual(await deletedGetResponse.json(), { error: 'Not Found' });
});
