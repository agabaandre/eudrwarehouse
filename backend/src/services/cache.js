const redis = require('../db/redis');
const config = require('../config');

const PREFIX = config.redis.keyPrefix;

function fullKey(namespace, key) {
  return `${PREFIX}${namespace}:${key}`;
}

async function get(namespace, key) {
  if (!redis.isAvailable()) return null;
  try {
    const raw = await redis.getClient().get(fullKey(namespace, key));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function set(namespace, key, value, ttlSeconds) {
  if (!redis.isAvailable()) return false;
  try {
    const k = fullKey(namespace, key);
    const payload = JSON.stringify(value);
    if (ttlSeconds > 0) {
      await redis.getClient().setEx(k, ttlSeconds, payload);
    } else {
      await redis.getClient().set(k, payload);
    }
    return true;
  } catch {
    return false;
  }
}

async function del(namespace, key) {
  if (!redis.isAvailable()) return;
  try {
    await redis.getClient().del(fullKey(namespace, key));
  } catch {
    /* ignore */
  }
}

async function invalidateNamespace(namespace) {
  if (!redis.isAvailable()) return 0;
  const pattern = `${PREFIX}${namespace}:*`;
  let deleted = 0;
  try {
    const client = redis.getClient();
    for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      await client.del(key);
      deleted += 1;
    }
  } catch {
    /* ignore */
  }
  return deleted;
}

async function invalidateAll(namespaces) {
  const results = await Promise.all(namespaces.map((ns) => invalidateNamespace(ns)));
  return results.reduce((a, b) => a + b, 0);
}

/** Invalidate caches after data mutations (ingestion, registration, warehouse sync). */
async function invalidateDataCaches() {
  const count = await invalidateAll([
    'analytics',
    'geo',
    'supply',
    'training',
    'registration',
    'warehouse',
  ]);
  if (count > 0) {
    console.log(`Cache: invalidated ${count} keys after data change`);
  }
  return count;
}

async function wrap(namespace, key, ttlSeconds, fetchFn) {
  const cached = await get(namespace, key);
  if (cached !== null) {
    return { ...cached, _cache: 'HIT' };
  }
  const value = await fetchFn();
  await set(namespace, key, value, ttlSeconds);
  return { ...value, _cache: 'MISS' };
}

module.exports = {
  get,
  set,
  del,
  wrap,
  invalidateNamespace,
  invalidateAll,
  invalidateDataCaches,
  TTL: config.redis.ttl,
};
