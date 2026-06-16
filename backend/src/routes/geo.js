const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db/postgres');
const { authMiddleware } = require('../middleware/auth');
const { runWarehouseSync, getWarehouseStatus } = require('../services/warehouse');

const router = express.Router();
const geoDir = path.join(__dirname, '../../../public/data');

const LAYERS = {
  districts: {
    file: 'uganda-districts.geojson',
    name: 'District Boundaries',
    description: 'Uganda district polygons with compliance overlay',
    type: 'choropleth',
  },
  regions: {
    file: 'uganda-regions.geojson',
    name: 'Regional Boundaries',
    description: 'Four macro-regions of Uganda',
    type: 'choropleth',
  },
  'coffee-belt': {
    file: 'uganda-coffee-belt.geojson',
    name: 'Coffee Production Belt',
    description: 'Primary coffee-growing districts',
    type: 'choropleth',
  },
  'risk-zones': {
    file: 'uganda-risk-zones.geojson',
    name: 'Deforestation Risk Zones',
    description: 'High/medium/low risk areas for EUDR compliance',
    type: 'heatmap',
  },
  'farm-clusters': {
    file: null,
    name: 'Registered Farm Clusters',
    description: 'Geolocated farm plot points from the registry',
    type: 'points',
  },
};

router.get('/layers', (req, res) => {
  res.json({
    layers: Object.entries(LAYERS).map(([id, meta]) => ({ id, ...meta })),
  });
});

router.get('/layers/:layerId', async (req, res) => {
  const layer = LAYERS[req.params.layerId];
  if (!layer) return res.status(404).json({ error: 'Layer not found' });

  if (req.params.layerId === 'farm-clusters') {
    const { rows } = await db.query(`
      SELECT fp.plot_code, fp.latitude, fp.longitude, fp.commodity, fp.area_hectares,
             f.name AS farmer_name, d.name AS district, d.region, cr.status, cr.risk_score
      FROM farm_plots fp
      LEFT JOIN farmers f ON fp.farmer_id = f.id
      LEFT JOIN districts d ON fp.district_id = d.id
      LEFT JOIN compliance_records cr ON cr.farm_plot_id = fp.id
      WHERE fp.latitude IS NOT NULL
    `);
    const features = rows.map((r) => ({
      type: 'Feature',
      properties: {
        name: r.plot_code,
        farmer: r.farmer_name,
        district: r.district,
        region: r.region,
        commodity: r.commodity,
        status: r.status,
        risk_score: r.risk_score,
        area_hectares: r.area_hectares,
      },
      geometry: { type: 'Point', coordinates: [parseFloat(r.longitude), parseFloat(r.latitude)] },
    }));
    return res.json({ type: 'FeatureCollection', features });
  }

  const filePath = path.join(geoDir, layer.file);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'GeoJSON file not found' });

  const geo = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const metric = req.query.metric || 'compliance_rate';

  const { rows: districts } = await db.query('SELECT name, region, compliance_rate, risk_score, total_farms, production_tons FROM districts');
  const lookup = Object.fromEntries(districts.map((d) => [d.name, d]));

  geo.features = geo.features.map((f) => {
    const name = f.properties.name || f.properties.district;
    const d = lookup[name];
    if (d) {
      f.properties = {
        ...f.properties,
        compliance_rate: parseFloat(d.compliance_rate),
        risk_score: d.risk_score,
        total_farms: d.total_farms,
        production_tons: parseFloat(d.production_tons),
        region: d.region,
        [metric]: metric === 'risk_score' ? d.risk_score : parseFloat(d.compliance_rate),
      };
    }
    return f;
  });

  res.json(geo);
});

router.get('/districts', async (req, res) => {
  const { rows } = await db.query(`
    SELECT d.*, COUNT(fp.id)::int AS mapped_plots
    FROM districts d
    LEFT JOIN farm_plots fp ON fp.district_id = d.id
    GROUP BY d.id ORDER BY d.name
  `);
  res.json({ data: rows });
});

module.exports = router;
