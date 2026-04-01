import http from 'node:http';
import { fileURLToPath } from 'node:url';

import { router as defaultRouter } from './router.js';

const PORT = Number(process.env.PORT || 3456);

function createApp({ router = defaultRouter } = {}) {
  return http.createServer((req, res) => {
    Promise.resolve(router(req, res)).catch((error) => {
      console.error(error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    });
  });
}

const server = createApp();

function startServer(port = PORT, options) {
  const app = options ? createApp(options) : server;

  return new Promise((resolve) => {
    app.listen(port, () => {
      console.log(`Listening on :${port}`);
      resolve(app);
    });
  });
}

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  startServer();
}

export { createApp, server, startServer };
