const cache = require('../services/cache');

/**
 * Redis HTTP response cache for GET requests.
 * Sets X-Cache: HIT|MISS header. Skips when Redis unavailable.
 */
function httpCache(namespace, ttlSeconds, options = {}) {
  const { skip } = options;

  return async (req, res, next) => {
    if (req.method !== 'GET') return next();
    if (skip?.(req)) return next();

    const cacheKey = req.originalUrl;
    const hit = await cache.get(namespace, cacheKey);
    if (hit !== null) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(hit);
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      res.setHeader('X-Cache', 'MISS');
      if (res.statusCode < 400) {
        cache.set(namespace, cacheKey, body, ttlSeconds).catch(() => {});
      }
      return originalJson(body);
    };

    next();
  };
}

module.exports = { httpCache };
