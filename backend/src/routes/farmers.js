const express = require('express');
const db = require('../db/postgres');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { district, status, limit = 50, offset = 0 } = req.query;
    let sql = `
      SELECT f.*, d.name AS district_name
      FROM farmers f
      LEFT JOIN districts d ON f.district_id = d.id
      WHERE 1=1`;
    const params = [];
    if (district) {
      params.push(district);
      sql += ` AND d.name ILIKE $${params.length}`;
    }
    sql += ` ORDER BY f.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));
    const { rows } = await db.query(sql, params);
    const { rows: countRows } = await db.query('SELECT COUNT(*)::int AS total FROM farmers');
    res.json({ data: rows, total: countRows[0].total, limit: parseInt(limit, 10), offset: parseInt(offset, 10) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT f.*, d.name AS district_name, d.region
       FROM farmers f LEFT JOIN districts d ON f.district_id = d.id WHERE f.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Farmer not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { farmer_code, name, gender, age_group, phone, district_name, sub_county } = req.body;
    let districtId = null;
    if (district_name) {
      const { rows } = await db.query('SELECT id FROM districts WHERE name ILIKE $1', [district_name]);
      districtId = rows[0]?.id;
    }
    const { rows } = await db.query(
      `INSERT INTO farmers (farmer_code, name, gender, age_group, phone, district_id, sub_county)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [farmer_code, name, gender, age_group, phone, districtId, sub_county]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
