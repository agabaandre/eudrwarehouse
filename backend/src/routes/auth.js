const express = require('express');
const config = require('../config');
const { login } = require('../middleware/auth');

const router = express.Router();

router.post('/login', login);

router.get('/config', (req, res) => {
  const superset = {
    enabled: true,
    url: config.superset.url,
    public_enabled: config.superset.publicEnabled,
    admin_user: config.superset.adminUser,
    admin_password: config.superset.adminPassword,
    note: config.superset.publicEnabled
      ? 'Superset link is visible on the public landing page'
      : 'Superset link is only shown in the authenticated management dashboard',
  };

  res.json({
    public_user_guide_enabled: config.publicUserGuideEnabled,
    platform: 'MAAIF EUDR Compliance Demonstration Platform',
    version: '1.1.0',
    superset,
    warehouse: {
      engine: 'Apache Doris',
      bi_tool: 'Apache Superset',
      sync_interval_ms: config.warehouse.syncIntervalMs,
    },
    geo_layers: ['/api/geo/layers'],
  });
});

module.exports = router;
