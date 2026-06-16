const express = require('express');
const db = require('../db/postgres');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { status, recipient_type, limit = 50 } = req.query;
    let sql = `
      SELECT sa.*, f.name AS farmer_name, e.name AS exporter_name
      FROM sms_alerts sa
      LEFT JOIN farmers f ON f.id = sa.farmer_id
      LEFT JOIN exporters e ON e.id = sa.exporter_id
      WHERE 1=1`;
    const params = [];
    if (status) { params.push(status); sql += ` AND sa.status = $${params.length}`; }
    if (recipient_type) { params.push(recipient_type); sql += ` AND sa.recipient_type = $${params.length}`; }
    params.push(parseInt(limit, 10));
    sql += ` ORDER BY sa.created_at DESC LIMIT $${params.length}`;
    const { rows } = await db.query(sql, params);
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/send', async (req, res) => {
  try {
    const {
      recipient_phone, recipient_type, farmer_id, exporter_id,
      message, alert_type,
    } = req.body;

    if (!recipient_phone || !message) {
      return res.status(400).json({ error: 'recipient_phone and message required' });
    }

    const { rows } = await db.query(
      `INSERT INTO sms_alerts
        (recipient_phone, recipient_type, farmer_id, exporter_id, message, alert_type, status, sent_at)
       VALUES ($1,$2,$3,$4,$5,$6,'sent',NOW()) RETURNING *`,
      [recipient_phone, recipient_type || 'farmer', farmer_id || null, exporter_id || null,
        message, alert_type || 'general']
    );

    res.status(201).json({
      ...rows[0],
      delivery_note: 'SMS queued via MAAIF gateway (demo mode — logged to database)',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/broadcast-compliance', authMiddleware, async (req, res) => {
  try {
    const { district, status } = req.body;
    let sql = `
      SELECT DISTINCT f.id, f.phone, f.name, cr.status
      FROM farmers f
      JOIN farm_plots fp ON fp.farmer_id = f.id
      JOIN compliance_records cr ON cr.farm_plot_id = fp.id
      LEFT JOIN districts d ON d.id = f.district_id
      WHERE f.sms_alerts_enabled = true AND f.phone IS NOT NULL`;
    const params = [];
    if (district) { params.push(district); sql += ` AND d.name ILIKE $${params.length}`; }
    if (status) { params.push(status); sql += ` AND cr.status = $${params.length}`; }

    const { rows: farmers } = await db.query(sql, params);
    const sent = [];
    for (const f of farmers) {
      const msg = `MAAIF EUDR: ${f.name}, your compliance status is ${(f.status || 'pending').toUpperCase()}. Visit platform or dial *284# for details.`;
      const { rows } = await db.query(
        `INSERT INTO sms_alerts (recipient_phone, recipient_type, farmer_id, message, alert_type, status, sent_at)
         VALUES ($1,'farmer',$2,$3,'compliance','sent',NOW()) RETURNING id`,
        [f.phone, f.id, msg]
      );
      sent.push(rows[0].id);
    }
    res.json({ broadcast_count: sent.length, alert_ids: sent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
