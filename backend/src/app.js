const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const doris = require('./db/doris');
const { syncToDoris } = require('./scripts/sync-to-doris');
const { invalidateDataCaches } = require('./services/cache');
const { compression, securityHeaders, createRateLimiters } = require('./middleware/security');
const { httpCache } = require('./middleware/cache');
const cacheService = require('./services/cache');
const redis = require('./db/redis');

const authRoutes = require('./routes/auth');
const farmersRoutes = require('./routes/farmers');
const farmPlotsRoutes = require('./routes/farmPlots');
const complianceRoutes = require('./routes/compliance');
const analyticsRoutes = require('./routes/analytics');
const ingestionRoutes = require('./routes/ingestion');
const geoRoutes = require('./routes/geo');
const warehouseRoutes = require('./routes/warehouse');
const exportersRoutes = require('./routes/exporters');
const registrationRoutes = require('./routes/registration');
const supplyChainRoutes = require('./routes/supplyChain');
const trainingRoutes = require('./routes/training');
const channelsRoutes = require('./routes/channels');
const alertsRoutes = require('./routes/alerts');
const sitemapRoutes = require('./routes/sitemap');

const app = express();
const { apiLimiter, authLimiter, ingestLimiter } = createRateLimiters();

app.use(compression());
app.use(securityHeaders);
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(sitemapRoutes);

app.use('/api/auth/login', authLimiter);
app.use('/api/ingestion', ingestLimiter);
app.use('/api', apiLimiter);

app.use('/api/analytics', httpCache('analytics', cacheService.TTL.analytics));
app.use('/api/geo', httpCache('geo', cacheService.TTL.geo));
app.use('/api/supply-chain', httpCache('supply', cacheService.TTL.supply));
app.use('/api/training', httpCache('training', cacheService.TTL.training));
app.use('/api/registration', httpCache('registration', cacheService.TTL.registration, {
  skip: (req) => req.method !== 'GET' || req.path !== '/districts',
}));
app.use('/api/warehouse', httpCache('warehouse', cacheService.TTL.warehouse, {
  skip: (req) => req.path.includes('/sync'),
}));

app.use('/api/auth', authRoutes);
app.use('/api/farmers', farmersRoutes);
app.use('/api/farm-plots', farmPlotsRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ingestion', ingestionRoutes);
app.use('/api/geo', geoRoutes);
app.use('/api/warehouse', warehouseRoutes);
app.use('/api/exporters', exportersRoutes);
app.use('/api/registration', registrationRoutes);
app.use('/api/supply-chain', supplyChainRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/channels', channelsRoutes);
app.use('/api/alerts', alertsRoutes);

app.get('/api/health', async (req, res) => {
  res.json({
    status: 'ok',
    service: 'maaif-eudr-platform',
    redis: redis.isAvailable() ? 'connected' : 'unavailable',
  });
});

app.get('/api/mobile', (req, res) => {
  res.json({
    message: 'MAAIF EUDR Mobile Integration API',
    endpoints: {
      farmers: 'GET /api/farmers',
      farm_plots: 'GET /api/farm-plots',
      compliance: 'GET /api/compliance',
      analytics: 'GET /api/analytics/kpis',
      auth: 'POST /api/auth/login',
      registration: 'POST /api/registration/farmer',
      supply_chain: 'GET /api/supply-chain/network',
      training: 'GET /api/training/modules',
      ussd: 'POST /api/channels/ussd',
      sms_alerts: 'GET /api/alerts',
    },
    authentication: 'Bearer token required for ingestion endpoints',
  });
});

const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir, {
  index: false,
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
  setHeaders(res, filePath) {
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Not found' });
  }
  if (req.path.startsWith('/management')) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

async function start() {
  await redis.connect();
  await doris.connect();
  if (config.warehouse.syncOnStart) {
    setTimeout(() => syncToDoris().then(() => invalidateDataCaches()).catch(() => {}), 8000);
    if (config.warehouse.syncIntervalMs > 0) {
      setInterval(() => syncToDoris().then(() => invalidateDataCaches()).catch(() => {}), config.warehouse.syncIntervalMs);
    }
  }
  app.listen(config.port, config.host, () => {
    const accessUrl = config.publicBaseUrl || `http://localhost:${config.port}`;
    console.log(`MAAIF EUDR Platform listening on ${config.host}:${config.port}`);
    console.log(`Access URL: ${accessUrl}`);
    console.log(`Public user guide: ${config.publicUserGuideEnabled ? 'enabled' : 'disabled'}`);
    console.log(`Superset: ${config.superset.url} (public: ${config.superset.publicEnabled})`);
    console.log(`Redis cache: ${redis.isAvailable() ? 'enabled' : 'disabled (in-memory rate limits only)'}`);
  });
}

module.exports = { app, start };
