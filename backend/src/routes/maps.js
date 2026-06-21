const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { getAdminView, saveSettings } = require('../services/mapSettings');

const router = express.Router();

const VALID_LAYERS = new Set(['districts', 'regions', 'coffee-belt', 'risk-zones', 'farm-clusters']);
const VALID_METRICS = new Set(['compliance_rate', 'risk_score', 'production_tons']);

router.get('/admin/config', authMiddleware, async (req, res) => {
  try {
    res.json(await getAdminView());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/admin/config', authMiddleware, async (req, res) => {
  try {
    const body = req.body || {};
    const patch = {};

    if (body.google_maps_enabled !== undefined) {
      patch.google_maps_enabled = !!body.google_maps_enabled;
    }
    if (body.api_key !== undefined) patch.api_key = String(body.api_key).trim();
    if (body.default_layer && VALID_LAYERS.has(body.default_layer)) {
      patch.default_layer = body.default_layer;
    }
    if (body.default_metric && VALID_METRICS.has(body.default_metric)) {
      patch.default_metric = body.default_metric;
    }
    if (Array.isArray(body.hidden_layer_ids)) {
      patch.hidden_layer_ids = body.hidden_layer_ids.filter((id) => VALID_LAYERS.has(id));
    }
    if (body.show_highcharts_district_panel !== undefined) {
      patch.show_highcharts_district_panel = !!body.show_highcharts_district_panel;
    }

    await saveSettings(patch);
    res.json({ message: 'Map configuration saved', settings: await getAdminView() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
