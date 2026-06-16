require('dotenv').config();

function resolvePublicBaseUrl() {
  const raw = process.env.PUBLIC_BASE_URL;
  if (!raw) return null;
  return raw.replace(/\/$/, '');
}

function resolveSupersetUrl(publicBaseUrl) {
  if (process.env.SUPERSET_URL) {
    return process.env.SUPERSET_URL.replace(/\/$/, '');
  }
  if (publicBaseUrl) {
    try {
      const url = new URL(publicBaseUrl);
      url.port = process.env.SUPERSET_PORT || '8088';
      url.pathname = '';
      return url.toString().replace(/\/$/, '');
    } catch {
      return `http://localhost:8088`;
    }
  }
  return 'http://localhost:8088';
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
    publicEnabled: process.env.SUPERSET_PUBLIC_ENABLED === 'true',
    adminUser: process.env.SUPERSET_ADMIN_USER || 'admin',
    adminPassword: process.env.SUPERSET_ADMIN_PASSWORD || 'admin',
  },
  warehouse: {
    syncOnStart: process.env.DORIS_SYNC_ON_START !== 'false',
    syncIntervalMs: parseInt(process.env.WAREHOUSE_SYNC_INTERVAL_MS || '300000', 10),
  },
  jwtSecret: process.env.JWT_SECRET || 'maaif-eudr-demo-secret',
  publicUserGuideEnabled: process.env.PUBLIC_USER_GUIDE_ENABLED !== 'false',
  admin: {
    email: 'admin@admin.com',
    password: 'admin',
  },
};
