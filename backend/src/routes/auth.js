const express = require('express');
const config = require('../config');
const { login } = require('../middleware/auth');
const { httpCache } = require('../middleware/cache');
const cache = require('../services/cache');

const router = express.Router();

router.post('/login', login);

router.get('/config', httpCache('config', cache.TTL.config), (req, res) => {
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
    public_base_url: config.publicBaseUrl,
    platform: 'MAAIF EUDR Compliance Demonstration Platform',
    version: '2.0.0',
    frontend: 'vue3',
    superset,
    warehouse: {
      engine: 'Apache Doris',
      bi_tool: 'Apache Superset',
      sync_interval_ms: config.warehouse.syncIntervalMs,
    },
    geo_layers: ['/api/geo/layers'],
    registration: {
      hub_url: '/registration',
      farmer_register: 'POST /api/registration/farmer',
      exporter_register: 'POST /api/registration/exporter',
      supply_chain: 'GET /api/supply-chain/network',
      training: 'GET /api/training/modules',
      ussd_code: '*284#',
      sms_alerts: 'GET /api/alerts',
      mobile_link: 'POST /api/channels/mobile/register',
    },
  });
});

module.exports = router;
