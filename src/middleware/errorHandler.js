import { AppError } from '../errors/AppError.js';

export function errorHandler(err, req, res) {
  if (err instanceof AppError) {
    res.writeHead(err.statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
    return;
  }

  // Unknown errors — log and return generic 500
  console.error(err);
  res.writeHead(500, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Internal Server Error' }));
}
