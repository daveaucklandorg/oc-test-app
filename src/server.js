import http from 'node:http';

const PORT = process.env.PORT || 3456;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('oc-test-app scaffold');
});

server.listen(PORT, () => {
  console.log(`Listening on :${PORT}`);
});

export { server };
