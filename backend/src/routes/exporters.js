const express = require('express');
const db = require('../db/postgres');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    let sql = `
      SELECT e.*, d.name AS district_name
      FROM exporters e
      LEFT JOIN districts d ON e.district_id = d.id
      WHERE 1=1`;
    const params = [];
    if (status) {
      params.push(status);
      sql += ` AND e.status = $${params.length}`;
    }
    sql += ` ORDER BY e.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));
    const { rows } = await db.query(sql, params);
    const { rows: countRows } = await db.query('SELECT COUNT(*)::int AS total FROM exporters');
    res.json({ data: rows, total: countRows[0].total, limit: parseInt(limit, 10), offset: parseInt(offset, 10) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT e.*, d.name AS district_name, d.region
       FROM exporters e LEFT JOIN districts d ON e.district_id = d.id WHERE e.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Exporter not found' });

    const { rows: links } = await db.query(
      `SELECT scl.*, f.farmer_code, f.name AS farmer_name, cr.status AS compliance_status
       FROM supply_chain_links scl
       JOIN farmers f ON f.id = scl.farmer_id
       LEFT JOIN farm_plots fp ON fp.farmer_id = f.id
       LEFT JOIN compliance_records cr ON cr.farm_plot_id = fp.id
       WHERE scl.exporter_id = $1
       ORDER BY scl.linked_at DESC`,
      [req.params.id]
    );
    res.json({ ...rows[0], linked_farmers: links });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      exporter_code, name, email, phone, license_number, contact_person,
      district_name, commodities, primary_destination, registered_via,
    } = req.body;
    let districtId = null;
    if (district_name) {
      const { rows } = await db.query('SELECT id FROM districts WHERE name ILIKE $1', [district_name]);
      districtId = rows[0]?.id;
    }
    const code = exporter_code || `EXP-${Date.now().toString(36).toUpperCase()}`;
    const { rows } = await db.query(
      `INSERT INTO exporters
        (exporter_code, name, email, phone, license_number, contact_person,
         district_id, commodities, primary_destination, registered_via, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending') RETURNING *`,
      [code, name, email, phone, license_number, contact_person,
        districtId, commodities, primary_destination, registered_via || 'web']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
