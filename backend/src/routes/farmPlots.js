const express = require('express');
const db = require('../db/postgres');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { district, commodity, status, limit = 50, offset = 0 } = req.query;
    let sql = `
      SELECT fp.*, f.name AS farmer_name, d.name AS district_name, cr.status AS compliance_status, cr.risk_score
      FROM farm_plots fp
      LEFT JOIN farmers f ON fp.farmer_id = f.id
      LEFT JOIN districts d ON fp.district_id = d.id
      LEFT JOIN compliance_records cr ON cr.farm_plot_id = fp.id
      WHERE 1=1`;
    const params = [];
    if (district) { params.push(district); sql += ` AND d.name ILIKE $${params.length}`; }
    if (commodity) { params.push(commodity); sql += ` AND fp.commodity ILIKE $${params.length}`; }
    if (status) { params.push(status); sql += ` AND cr.status = $${params.length}`; }
    sql += ` ORDER BY fp.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));
    const { rows } = await db.query(sql, params);
    res.json({ data: rows, limit: parseInt(limit, 10), offset: parseInt(offset, 10) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT fp.*, f.name AS farmer_name, d.name AS district_name, d.region,
              cr.status, cr.risk_score, cr.risk_category, cr.non_compliance_reason
       FROM farm_plots fp
       LEFT JOIN farmers f ON fp.farmer_id = f.id
       LEFT JOIN districts d ON fp.district_id = d.id
       LEFT JOIN compliance_records cr ON cr.farm_plot_id = fp.id
       WHERE fp.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Farm plot not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { plot_code, farmer_id, district_name, sub_county, commodity, area_hectares, latitude, longitude } = req.body;
    let districtId = null;
    if (district_name) {
      const { rows } = await db.query('SELECT id FROM districts WHERE name ILIKE $1', [district_name]);
      districtId = rows[0]?.id;
    }
    const { rows } = await db.query(
      `INSERT INTO farm_plots (plot_code, farmer_id, district_id, sub_county, commodity, area_hectares, latitude, longitude)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [plot_code, farmer_id, districtId, sub_county, commodity || 'coffee', area_hectares, latitude, longitude]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
