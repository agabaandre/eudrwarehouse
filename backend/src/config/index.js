require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://eudr:eudr_secret@localhost:5432/eudr',
  doris: {
    host: process.env.DORIS_HOST || 'localhost',
    port: parseInt(process.env.DORIS_PORT || '9030', 10),
    user: process.env.DORIS_USER || 'root',
    password: process.env.DORIS_PASSWORD || '',
    database: process.env.DORIS_DATABASE || 'eudr_analytics',
  },
  superset: {
    url: process.env.SUPERSET_URL || 'http://localhost:8088',
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
