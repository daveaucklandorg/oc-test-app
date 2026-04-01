import assert from 'node:assert/strict';
import test from 'node:test';

test('errorHandler: AppError returns correct status and body', async () => {
  const { errorHandler } = await import('./middleware/errorHandler.js');
  const { AppError } = await import('./errors/AppError.js');

  let writtenStatus;
  let writtenHeaders;
  let writtenBody;
  const fakeRes = {
    writeHead(status, headers) { writtenStatus = status; writtenHeaders = headers; },
    end(body) { writtenBody = body; },
  };

  errorHandler(new AppError('Not Found', 404), {}, fakeRes);

  assert.equal(writtenStatus, 404);
  assert.deepEqual(JSON.parse(writtenBody), { error: 'Not Found' });
});

test('errorHandler: unknown error returns 500 with safe message', async () => {
  const { errorHandler } = await import('./middleware/errorHandler.js');

  let writtenStatus;
  let writtenBody;
  const fakeRes = {
    writeHead(status) { writtenStatus = status; },
    end(body) { writtenBody = body; },
  };

  // Suppress console.error for this test
  const origError = console.error;
  console.error = () => {};
  try {
    errorHandler(new Error('something unexpected'), {}, fakeRes);
  } finally {
    console.error = origError;
  }

  assert.equal(writtenStatus, 500);
  assert.deepEqual(JSON.parse(writtenBody), { error: 'Internal Server Error' });
});
