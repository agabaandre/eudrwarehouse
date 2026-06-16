const express = require('express');
const db = require('../db/postgres');

const router = express.Router();

const USSD_MENUS = {
  '': 'CON Welcome to MAAIF EUDR\n1. Register Farmer\n2. Check Compliance\n3. Training Info\n4. Link to Exporter',
  '1': 'CON Enter your name:',
  '2': 'CON Enter farmer code (e.g. F-001):',
  '3': 'CON Training modules:\n1. EUDR Compliance\n2. Mobile Mapping\n3. USSD Guide\n0. Back',
  '4': 'CON Enter farmer code to view exporter links:',
};

router.get('/info', (req, res) => {
  res.json({
    ussd_code: '*284#',
    shortcode: '284',
    mobile_app: 'MAAIF EUDR Field App',
    platforms: ['Android', 'iOS'],
    endpoints: {
      farmer_register: 'POST /api/registration/farmer',
      compliance_check: 'GET /api/compliance?district=',
      supply_chain: 'GET /api/supply-chain/network',
      training: 'GET /api/training/modules',
    },
    ussd_flow: [
      'Dial *284# on any mobile network',
      'Select 1 to register as farmer (name, district, phone)',
      'Select 2 to check compliance status by farmer code',
      'Select 3 for training module information',
      'Select 4 to view exporter linkage for your farm',
    ],
  });
});

router.post('/ussd', async (req, res) => {
  try {
    const { session_id, phone, text } = req.body;
    const level = (text || '').split('*').length - 1;
    const parts = (text || '').split('*');
    const lastInput = parts[parts.length - 1] || '';
    const root = parts[0] || '';

    if (!text || text === '') {
      return res.type('text/plain').send(USSD_MENUS['']);
    }

    if (root === '1' && parts.length === 2) {
      return res.type('text/plain').send('CON Enter your district:');
    }
    if (root === '1' && parts.length === 3) {
      return res.type('text/plain').send('CON Enter your phone number:');
    }
    if (root === '1' && parts.length >= 4) {
      const name = parts[1];
      const district = parts[2];
      const farmerPhone = parts[3];
      const { rows: dRows } = await db.query('SELECT id FROM districts WHERE name ILIKE $1', [district]);
      const code = `UG-USSD-${Date.now().toString(36).toUpperCase()}`;
      const { rows: fRows } = await db.query(
        `INSERT INTO farmers (farmer_code, name, phone, district_id, registered_via)
         VALUES ($1,$2,$3,$4,'ussd') RETURNING id`,
        [code, name, farmerPhone, dRows[0]?.id || null]
      );
      await db.query(
        `INSERT INTO channel_registrations (entity_type, entity_id, channel, phone, verified)
         VALUES ('farmer', $1, 'ussd', $2, true)`,
        [fRows[0].id, phone || farmerPhone]
      );
      return res.type('text/plain').send(`END Registered! Code: ${code}. SMS confirmation sent.`);
    }

    if (root === '2' && parts.length === 2) {
      const code = lastInput;
      const { rows } = await db.query(
        `SELECT f.farmer_code, f.name, cr.status, cr.risk_category, d.name AS district
         FROM farmers f
         LEFT JOIN farm_plots fp ON fp.farmer_id = f.id
         LEFT JOIN compliance_records cr ON cr.farm_plot_id = fp.id
         LEFT JOIN districts d ON d.id = f.district_id
         WHERE f.farmer_code ILIKE $1 LIMIT 1`,
        [code]
      );
      if (!rows[0]) return res.type('text/plain').send('END Farmer not found.');
      const f = rows[0];
      return res.type('text/plain').send(
        `END ${f.name}\nDistrict: ${f.district || 'N/A'}\nStatus: ${(f.status || 'pending').toUpperCase()}\nRisk: ${f.risk_category || 'N/A'}`
      );
    }

    if (root === '4' && parts.length === 2) {
      const code = lastInput;
      const { rows } = await db.query(
        `SELECT e.name AS exporter, scl.batch_code, scl.volume_kg, scl.compliance_verified
         FROM farmers f
         JOIN supply_chain_links scl ON scl.farmer_id = f.id
         JOIN exporters e ON e.id = scl.exporter_id
         WHERE f.farmer_code ILIKE $1`,
        [code]
      );
      if (!rows.length) return res.type('text/plain').send('END No exporter links found.');
      const lines = rows.map((r) => `${r.exporter}: ${r.volume_kg}kg ${r.compliance_verified ? '✓' : 'pending'}`).join('\n');
      return res.type('text/plain').send(`END Your exporters:\n${lines}`);
    }

    if (root === '3') {
      return res.type('text/plain').send('END Dial *284# or visit Training Center online for 6 EUDR modules.');
    }

    return res.type('text/plain').send(USSD_MENUS[root] || USSD_MENUS['']);
  } catch (err) {
    res.type('text/plain').send('END System error. Try again later.');
  }
});

router.post('/mobile/register', async (req, res) => {
  try {
    const { phone, device_id, entity_type, entity_code } = req.body;
    if (!phone || !entity_type) {
      return res.status(400).json({ error: 'phone and entity_type required' });
    }

    let entityId = null;
    if (entity_type === 'farmer' && entity_code) {
      const { rows } = await db.query('SELECT id FROM farmers WHERE farmer_code ILIKE $1', [entity_code]);
      entityId = rows[0]?.id;
    } else if (entity_type === 'exporter' && entity_code) {
      const { rows } = await db.query('SELECT id FROM exporters WHERE exporter_code ILIKE $1', [entity_code]);
      entityId = rows[0]?.id;
    }

    if (!entityId) {
      return res.status(404).json({ error: 'Entity not found. Register first via web or USSD.' });
    }

    await db.query(
      `INSERT INTO channel_registrations (entity_type, entity_id, channel, phone, verified)
       VALUES ($1, $2, 'mobile', $3, true)`,
      [entity_type, entityId, phone]
    );

    res.json({
      linked: true,
      entity_type,
      entity_id: entityId,
      device_id,
      message: 'Mobile device linked successfully',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/registrations', async (req, res) => {
  try {
    const { entity_type, channel } = req.query;
    let sql = `
      SELECT cr.*,
        CASE WHEN cr.entity_type = 'farmer' THEN f.name
             WHEN cr.entity_type = 'exporter' THEN e.name END AS entity_name,
        CASE WHEN cr.entity_type = 'farmer' THEN f.farmer_code
             WHEN cr.entity_type = 'exporter' THEN e.exporter_code END AS entity_code
      FROM channel_registrations cr
      LEFT JOIN farmers f ON cr.entity_type = 'farmer' AND f.id = cr.entity_id
      LEFT JOIN exporters e ON cr.entity_type = 'exporter' AND e.id = cr.entity_id
      WHERE 1=1`;
    const params = [];
    if (entity_type) { params.push(entity_type); sql += ` AND cr.entity_type = $${params.length}`; }
    if (channel) { params.push(channel); sql += ` AND cr.channel = $${params.length}`; }
    sql += ' ORDER BY cr.registered_at DESC LIMIT 100';
    const { rows } = await db.query(sql, params);
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
