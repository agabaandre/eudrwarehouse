const express = require('express');
const db = require('../db/postgres');

const router = express.Router();

router.get('/modules', async (req, res) => {
  try {
    const { audience, category } = req.query;
    let sql = 'SELECT * FROM training_modules WHERE 1=1';
    const params = [];
    if (audience) {
      params.push(audience);
      sql += ` AND (target_audience = $${params.length} OR target_audience = 'both')`;
    }
    if (category) {
      params.push(category);
      sql += ` AND category = $${params.length}`;
    }
    sql += ' ORDER BY sort_order, id';
    const { rows } = await db.query(sql, params);
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/modules/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM training_modules WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Module not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/enroll', async (req, res) => {
  try {
    const { farmer_id, exporter_id, module_id } = req.body;
    if (!module_id || (!farmer_id && !exporter_id)) {
      return res.status(400).json({ error: 'module_id and farmer_id or exporter_id required' });
    }
    const { rows } = await db.query(
      `INSERT INTO training_enrollments (farmer_id, exporter_id, module_id, progress_pct)
       VALUES ($1,$2,$3,0) RETURNING *`,
      [farmer_id || null, exporter_id || null, module_id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/enroll/:id/progress', async (req, res) => {
  try {
    const { progress_pct } = req.body;
    const { rows } = await db.query(
      `UPDATE training_enrollments
       SET progress_pct = $1, completed_at = CASE WHEN $1 >= 100 THEN NOW() ELSE NULL END
       WHERE id = $2 RETURNING *`,
      [progress_pct, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Enrollment not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const { rows: modules } = await db.query('SELECT COUNT(*)::int AS c FROM training_modules');
    const { rows: enrollments } = await db.query('SELECT COUNT(*)::int AS c FROM training_enrollments');
    const { rows: completed } = await db.query(
      'SELECT COUNT(*)::int AS c FROM training_enrollments WHERE progress_pct >= 100'
    );
    res.json({
      modules: modules[0].c,
      enrollments: enrollments[0].c,
      completed: completed[0].c,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
