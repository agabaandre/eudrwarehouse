const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const redis = require('../db/redis');

const PRIVATE_PATHS = ['/management', '/api/'];

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-XSS-Protection', '0');

  const isPrivate = PRIVATE_PATHS.some((p) => req.path === p || req.path.startsWith(p));
  if (isPrivate) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  }

  next();
}

function redisRateLimitStore(prefix) {
  if (!redis.isAvailable()) return undefined;
  return new RedisStore({
    prefix: `eudr:rl:${prefix}:`,
    sendCommand: (...args) => redis.getClient().sendCommand(args),
  });
}

function createRateLimiters() {
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_API_MAX || '300', 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again shortly.' },
    skip: (req) => req.path === '/api/health',
    store: redisRateLimitStore('api'),
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '20', 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Try again later.' },
    store: redisRateLimitStore('auth'),
  });

  const ingestLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_INGEST_MAX || '10', 10),
    message: { error: 'Upload rate limit exceeded.' },
    store: redisRateLimitStore('ingest'),
  });

  return { apiLimiter, authLimiter, ingestLimiter };
}

module.exports = {
  compression,
  securityHeaders,
  createRateLimiters,
};
