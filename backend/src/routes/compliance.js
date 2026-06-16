const express = require('express');
const db = require('../db/postgres');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { status, district, risk_category, limit = 50, offset = 0 } = req.query;
    let sql = `
      SELECT cr.*, fp.plot_code, fp.commodity, fp.latitude, fp.longitude,
             f.name AS farmer_name, d.name AS district_name
      FROM compliance_records cr
      JOIN farm_plots fp ON cr.farm_plot_id = fp.id
      LEFT JOIN farmers f ON fp.farmer_id = f.id
      LEFT JOIN districts d ON fp.district_id = d.id
      WHERE 1=1`;
    const params = [];
    if (status) { params.push(status); sql += ` AND cr.status = $${params.length}`; }
    if (district) { params.push(district); sql += ` AND d.name ILIKE $${params.length}`; }
    if (risk_category) { params.push(risk_category); sql += ` AND cr.risk_category = $${params.length}`; }
    sql += ` ORDER BY cr.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));
    const { rows } = await db.query(sql, params);
    res.json({ data: rows, limit: parseInt(limit, 10), offset: parseInt(offset, 10) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT status, COUNT(*)::int AS count
      FROM compliance_records GROUP BY status
    `);
    const total = rows.reduce((s, r) => s + r.count, 0);
    const summary = rows.map((r) => ({
      status: r.status,
      count: r.count,
      percentage: total ? Math.round((r.count / total) * 1000) / 10 : 0,
    }));
    res.json({ total, summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT cr.*, fp.plot_code, f.name AS farmer_name, d.name AS district_name
       FROM compliance_records cr
       JOIN farm_plots fp ON cr.farm_plot_id = fp.id
       LEFT JOIN farmers f ON fp.farmer_id = f.id
       LEFT JOIN districts d ON fp.district_id = d.id
       WHERE cr.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Compliance record not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { farm_plot_id, status, risk_score, risk_category, certification_type, non_compliance_reason } = req.body;
    const { rows } = await db.query(
      `INSERT INTO compliance_records (farm_plot_id, status, risk_score, risk_category, certification_type, non_compliance_reason)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [farm_plot_id, status, risk_score || 0, risk_category, certification_type, non_compliance_reason]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
