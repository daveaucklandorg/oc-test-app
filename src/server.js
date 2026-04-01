import http from 'node:http';
import { fileURLToPath } from 'node:url';

import { router } from './router.js';
import { asyncHandler } from './middleware/asyncHandler.js';

const PORT = Number(process.env.PORT || 3456);

const handleRequest = asyncHandler(router);

function createApp() {
  return http.createServer((req, res) => {
    handleRequest(req, res);
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
