import http from 'node:http';
import { fileURLToPath } from 'node:url';

import { rateLimiter as defaultRateLimiter } from './middleware/rateLimiter.js';
import { router } from './router.js';

const PORT = Number(process.env.PORT || 3456);

function createApp({ rateLimiter = defaultRateLimiter } = {}) {
  return http.createServer((req, res) => {
    rateLimiter(req, res, () => {
      Promise.resolve(router(req, res)).catch((error) => {
        console.error(error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
      });
    });
  });
}

const server = createApp();

function startServer(port = PORT) {
  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`Listening on :${port}`);
      resolve(server);
    });
  });
}

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  startServer();
}

export { createApp, server, startServer };
