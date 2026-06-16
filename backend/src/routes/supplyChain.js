const express = require('express');
const db = require('../db/postgres');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/summary', async (req, res) => {
  try {
    const [links, farmers, exporters, verified] = await Promise.all([
      db.query('SELECT COUNT(*)::int AS c FROM supply_chain_links'),
      db.query('SELECT COUNT(DISTINCT farmer_id)::int AS c FROM supply_chain_links'),
      db.query('SELECT COUNT(DISTINCT exporter_id)::int AS c FROM supply_chain_links'),
      db.query('SELECT COUNT(*)::int AS c FROM supply_chain_links WHERE compliance_verified = true'),
    ]);
    res.json({
      total_links: links.rows[0].c,
      linked_farmers: farmers.rows[0].c,
      linked_exporters: exporters.rows[0].c,
      verified_batches: verified.rows[0].c,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/links', async (req, res) => {
  try {
    const { exporter_id, farmer_id, commodity, verified } = req.query;
    let sql = `
      SELECT scl.*,
        f.farmer_code, f.name AS farmer_name, f.phone AS farmer_phone,
        d.name AS district_name,
        e.exporter_code, e.name AS exporter_name, e.primary_destination,
        cr.status AS compliance_status, cr.risk_category
      FROM supply_chain_links scl
      JOIN farmers f ON f.id = scl.farmer_id
      JOIN exporters e ON e.id = scl.exporter_id
      LEFT JOIN districts d ON d.id = f.district_id
      LEFT JOIN farm_plots fp ON fp.farmer_id = f.id
      LEFT JOIN compliance_records cr ON cr.farm_plot_id = fp.id
      WHERE 1=1`;
    const params = [];
    if (exporter_id) { params.push(exporter_id); sql += ` AND scl.exporter_id = $${params.length}`; }
    if (farmer_id) { params.push(farmer_id); sql += ` AND scl.farmer_id = $${params.length}`; }
    if (commodity) { params.push(commodity); sql += ` AND scl.commodity ILIKE $${params.length}`; }
    if (verified === 'true') sql += ` AND scl.compliance_verified = true`;
    if (verified === 'false') sql += ` AND scl.compliance_verified = false`;
    sql += ' ORDER BY scl.linked_at DESC';
    const { rows } = await db.query(sql, params);
    res.json({ data: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/network', async (req, res) => {
  try {
    const { rows: links } = await db.query(`
      SELECT scl.id, scl.commodity, scl.volume_kg, scl.batch_code, scl.compliance_verified,
        f.id AS farmer_id, f.farmer_code, f.name AS farmer_name,
        e.id AS exporter_id, e.exporter_code, e.name AS exporter_name, e.primary_destination
      FROM supply_chain_links scl
      JOIN farmers f ON f.id = scl.farmer_id
      JOIN exporters e ON e.id = scl.exporter_id
      ORDER BY e.name, f.name`);

    const exporterMap = {};
    for (const link of links) {
      if (!exporterMap[link.exporter_id]) {
        exporterMap[link.exporter_id] = {
          exporter_id: link.exporter_id,
          exporter_code: link.exporter_code,
          exporter_name: link.exporter_name,
          destination: link.primary_destination,
          farmers: [],
          total_volume_kg: 0,
        };
      }
      exporterMap[link.exporter_id].farmers.push({
        farmer_id: link.farmer_id,
        farmer_code: link.farmer_code,
        farmer_name: link.farmer_name,
        commodity: link.commodity,
        volume_kg: parseFloat(link.volume_kg),
        batch_code: link.batch_code,
        compliance_verified: link.compliance_verified,
      });
      exporterMap[link.exporter_id].total_volume_kg += parseFloat(link.volume_kg || 0);
    }
    res.json({ exporters: Object.values(exporterMap), total_links: links.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/link', authMiddleware, async (req, res) => {
  try {
    const { farmer_id, exporter_id, commodity, volume_kg, batch_code, season } = req.body;
    const { rows } = await db.query(
      `INSERT INTO supply_chain_links
        (farmer_id, exporter_id, commodity, volume_kg, batch_code, season, compliance_verified)
       VALUES ($1,$2,$3,$4,$5,$6,false) RETURNING *`,
      [farmer_id, exporter_id, commodity || 'coffee', volume_kg, batch_code, season || '2025/26']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
