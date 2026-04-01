const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 100;
const DEFAULT_CLEANUP_INTERVAL_MS = 60_000;

function getClientIp(req) {
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
}

function createRateLimiter({
  limit = DEFAULT_MAX_REQUESTS,
  windowMs = DEFAULT_WINDOW_MS,
  cleanupIntervalMs = DEFAULT_CLEANUP_INTERVAL_MS,
  now = () => Date.now(),
} = {}) {
  const store = new Map();

  const cleanup = () => {
    const currentTime = now();

    for (const [ip, entry] of store.entries()) {
      if (currentTime - entry.windowStart >= windowMs) {
        store.delete(ip);
      }
    }
  };

  const cleanupInterval = setInterval(cleanup, cleanupIntervalMs);
  cleanupInterval.unref?.();

  const middleware = (req, res, next) => {
    const currentTime = now();
    const ip = getClientIp(req);
    const entry = store.get(ip);

    if (!entry || currentTime - entry.windowStart >= windowMs) {
      store.set(ip, { count: 1, windowStart: currentTime });
      next();
      return;
    }

    entry.count += 1;

    if (entry.count > limit) {
      const remainingMs = Math.max(windowMs - (currentTime - entry.windowStart), 0);
      const retryAfterSeconds = Math.max(1, Math.ceil(remainingMs / 1000));

      res.writeHead(429, {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSeconds),
      });
      res.end(JSON.stringify({ error: 'Too Many Requests' }));
      return;
    }

    next();
  };

  middleware.store = store;
  middleware.cleanup = cleanup;
  middleware.reset = () => {
    store.clear();
  };
  middleware.stopCleanup = () => {
    clearInterval(cleanupInterval);
  };

  return middleware;
}

const rateLimiter = createRateLimiter();

export { createRateLimiter, rateLimiter };
