const { createClient } = require('redis');
const config = require('../config');

let client = null;
let available = false;

async function connect() {
  if (!config.redis.enabled) {
    console.log('Redis: disabled (REDIS_URL not set)');
    return false;
  }

  try {
    client = createClient({
      url: config.redis.url,
      socket: {
        connectTimeout: config.redis.connectTimeoutMs,
        reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
      },
    });

    client.on('error', (err) => {
      console.error('Redis error:', err.message);
      available = false;
    });

    client.on('ready', () => {
      available = true;
    });

    await client.connect();
    await client.ping();
    available = true;
    console.log(`Redis: connected (${config.redis.url.replace(/:[^:@/]+@/, ':***@')})`);
    return true;
  } catch (err) {
    console.warn('Redis: unavailable — running without cache:', err.message);
    client = null;
    available = false;
    return false;
  }
}

async function disconnect() {
  if (client?.isOpen) {
    await client.quit();
  }
  client = null;
  available = false;
}

function isAvailable() {
  return available && client?.isOpen;
}

function getClient() {
  return client;
}

module.exports = {
  connect,
  disconnect,
  isAvailable,
  getClient,
};
