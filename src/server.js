import http from 'node:http';
import { fileURLToPath } from 'node:url';

import { router } from './router.js';

const PORT = Number(process.env.PORT || 3456);

function createApp() {
  return http.createServer((req, res) => {
    Promise.resolve(router(req, res)).catch((error) => {
      console.error(error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    });
  });
}

function startServer(port = PORT) {
  const server = createApp();

  return new Promise((resolve) => {
    server.listen(port, () => {
      const address = server.address();
      const resolvedPort = typeof address === 'object' && address ? address.port : port;
      console.log(`Listening on :${resolvedPort}`);
      resolve(server);
    });
  });
}

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  startServer();
}

export { createApp, startServer };
