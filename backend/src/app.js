const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const doris = require('./db/doris');
const { syncToDoris } = require('./scripts/sync-to-doris');
const { authMiddleware } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const farmersRoutes = require('./routes/farmers');
const farmPlotsRoutes = require('./routes/farmPlots');
const complianceRoutes = require('./routes/compliance');
const analyticsRoutes = require('./routes/analytics');
const ingestionRoutes = require('./routes/ingestion');
const geoRoutes = require('./routes/geo');
const warehouseRoutes = require('./routes/warehouse');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/farmers', farmersRoutes);
app.use('/api/farm-plots', farmPlotsRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ingestion', ingestionRoutes);
app.use('/api/geo', geoRoutes);
app.use('/api/warehouse', warehouseRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'maaif-eudr-platform' });
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
    },
    authentication: 'Bearer token required for ingestion endpoints',
  });
});

const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

async function start() {
  await doris.connect();
  if (config.warehouse.syncOnStart) {
    setTimeout(() => syncToDoris().catch(() => {}), 8000);
    if (config.warehouse.syncIntervalMs > 0) {
      setInterval(() => syncToDoris().catch(() => {}), config.warehouse.syncIntervalMs);
    }
  }
  app.listen(config.port, config.host, () => {
    const accessUrl = config.publicBaseUrl || `http://localhost:${config.port}`;
    console.log(`MAAIF EUDR Platform listening on ${config.host}:${config.port}`);
    console.log(`Access URL: ${accessUrl}`);
    console.log(`Public user guide: ${config.publicUserGuideEnabled ? 'enabled' : 'disabled'}`);
    console.log(`Superset: ${config.superset.url} (public: ${config.superset.publicEnabled})`);
  });
}

module.exports = { app, start };
