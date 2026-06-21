require('dotenv').config();

function resolvePublicBaseUrl() {
  const raw = process.env.PUBLIC_BASE_URL;
  if (!raw) return null;
  return normalizePublicBaseUrl(raw);
}

function normalizePublicBaseUrl(raw) {
  if (!raw) return null;
  let url = raw.replace(/\/$/, '');
  // Fix mistaken PUBLIC_BASE_URL=http://host:8003/superset
  url = url.replace(/\/superset(\/welcome)?$/i, '');
  return url;
}

function resolveSupersetUrl(publicBaseUrl) {
  const base = normalizePublicBaseUrl(publicBaseUrl);
  const envRaw = process.env.SUPERSET_URL?.trim();

  if (envRaw) {
    let url = envRaw.replace(/\/$/, '');
    url = url.replace(/(\/superset){2,}/gi, '/superset');
    if (/^https?:\/\//i.test(url)) {
      if (!/\/superset/i.test(url)) {
        url = `${base || url.replace(/\/[^/]*$/, '')}/superset`;
      }
      if (!/\/login/i.test(url) && !/\/welcome/i.test(url)) {
        url = `${url}/login`;
      }
      return url;
    }
    return url.startsWith('/') ? `${url}/` : `/${url}/`;
  }
  if (base) {
    return `${base}/superset/login`;
  }
  return '/superset/login/';
}

const publicBaseUrl = resolvePublicBaseUrl();

module.exports = {
  host: process.env.HOST || '0.0.0.0',
  port: parseInt(process.env.PORT || '3000', 10),
  publicBaseUrl,
  databaseUrl: process.env.DATABASE_URL || 'postgresql://eudr:eudr_secret@localhost:5432/eudr',
  doris: {
    host: process.env.DORIS_HOST || 'localhost',
    port: parseInt(process.env.DORIS_PORT || '9030', 10),
    user: process.env.DORIS_USER || 'root',
    password: process.env.DORIS_PASSWORD || '',
    database: process.env.DORIS_DATABASE || 'eudr_analytics',
  },
  superset: {
    url: resolveSupersetUrl(publicBaseUrl),
    basePath: '/superset',
    publicEnabled: process.env.SUPERSET_PUBLIC_ENABLED === 'true',
    warehouseRequired: process.env.ENABLE_WAREHOUSE === 'true',
    adminUser: process.env.SUPERSET_ADMIN_USER || 'admin',
    adminPassword: process.env.SUPERSET_ADMIN_PASSWORD || 'admin',
  },
  warehouse: {
    syncOnStart: process.env.DORIS_SYNC_ON_START === 'true',
    syncIntervalMs: parseInt(process.env.WAREHOUSE_SYNC_INTERVAL_MS || '300000', 10),
  },
  jwtSecret: process.env.JWT_SECRET || 'maaif-eudr-demo-secret',
  publicUserGuideEnabled: process.env.PUBLIC_USER_GUIDE_ENABLED !== 'false',
  admin: {
    email: 'admin@admin.com',
    password: 'admin',
  },
  ai: {
    enabled: process.env.AI_ASSISTANT_ENABLED !== 'false',
    defaultModel: process.env.AI_DEFAULT_MODEL || 'gpt-4o-mini',
    proRequiresAuth: process.env.AI_PRO_REQUIRES_AUTH !== 'false',
    alwaysShowFallback: process.env.AI_ALWAYS_SHOW_FALLBACK === 'true',
    providers: {
      openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      },
      gemini: {
        apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || '',
      },
      deepseek: {
        apiKey: process.env.DEEPSEEK_API_KEY || '',
        baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
      },
      custom: {
        apiKey: process.env.OPENAI_COMPAT_API_KEY || '',
        baseUrl: process.env.OPENAI_COMPAT_BASE_URL || '',
        model: process.env.OPENAI_COMPAT_MODEL || 'default',
      },
    },
  },
  redis: {
    enabled: process.env.REDIS_ENABLED !== 'false' && !!(process.env.REDIS_URL || process.env.REDIS_HOST),
    url: process.env.REDIS_URL || (
      process.env.REDIS_HOST
        ? `redis://${process.env.REDIS_PASSWORD ? `:${process.env.REDIS_PASSWORD}@` : ''}${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`
        : null
    ),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'eudr:v1:',
    connectTimeoutMs: parseInt(process.env.REDIS_CONNECT_TIMEOUT_MS || '5000', 10),
    ttl: {
      analytics: parseInt(process.env.CACHE_TTL_ANALYTICS || '120', 10),
      geo: parseInt(process.env.CACHE_TTL_GEO || '3600', 10),
      config: parseInt(process.env.CACHE_TTL_CONFIG || '300', 10),
      supply: parseInt(process.env.CACHE_TTL_SUPPLY || '60', 10),
      training: parseInt(process.env.CACHE_TTL_TRAINING || '1800', 10),
      registration: parseInt(process.env.CACHE_TTL_REGISTRATION || '3600', 10),
      warehouse: parseInt(process.env.CACHE_TTL_WAREHOUSE || '30', 10),
    },
  },
};
