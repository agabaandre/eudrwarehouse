const express = require('express');
const db = require('../db/postgres');
const { invalidateDataCaches } = require('../services/cache');

const router = express.Router();

async function resolveDistrictId(districtName) {
  if (!districtName) return null;
  const { rows } = await db.query('SELECT id FROM districts WHERE name ILIKE $1', [districtName]);
  return rows[0]?.id || null;
}

router.post('/farmer', async (req, res) => {
  try {
    const {
      farmer_code, name, gender, age_group, phone, district_name, sub_county,
      commodity, area_hectares, latitude, longitude, registered_via, channel,
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    const districtId = await resolveDistrictId(district_name);
    const code = farmer_code || `UG-F-${Date.now().toString(36).toUpperCase()}`;

    const { rows: farmerRows } = await db.query(
      `INSERT INTO farmers
        (farmer_code, name, gender, age_group, phone, district_id, sub_county, registered_via, sms_alerts_enabled)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true) RETURNING *`,
      [code, name, gender, age_group, phone, districtId, sub_county, registered_via || 'web']
    );
    const farmer = farmerRows[0];

    let plot = null;
    if (commodity || latitude) {
      const { rows: plotRows } = await db.query(
        `INSERT INTO farm_plots
          (plot_code, farmer_id, district_id, sub_county, commodity, area_hectares, latitude, longitude)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [code, farmer.id, districtId, sub_county, commodity || 'coffee', area_hectares || 1.0, latitude, longitude]
      );
      plot = plotRows[0];
      await db.query(
        `INSERT INTO compliance_records (farm_plot_id, status, risk_category, certification_type)
         VALUES ($1,'pending','medium','EUDR Compliance Only')`,
        [plot.id]
      );
    }

    if (channel && phone) {
      await db.query(
        `INSERT INTO channel_registrations (entity_type, entity_id, channel, phone, verified)
         VALUES ('farmer', $1, $2, $3, false)`,
        [farmer.id, channel, phone]
      );
    }

    await db.query(
      `INSERT INTO sms_alerts (recipient_phone, recipient_type, farmer_id, message, alert_type, status, sent_at)
       VALUES ($1,'farmer',$2,$3,'registration','sent',NOW())`,
      [phone, farmer.id, `MAAIF EUDR: Welcome ${name}! Your farmer code is ${code}. Check status via USSD *284# or the mobile app.`]
    );

    await invalidateDataCaches();
    res.status(201).json({ farmer, plot, message: 'Farmer registered successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/exporter', async (req, res) => {
  try {
    const {
      name, email, phone, license_number, contact_person,
      district_name, commodities, primary_destination, registered_via, channel,
    } = req.body;

    if (!name || !phone || !license_number) {
      return res.status(400).json({ error: 'Name, phone, and license number are required' });
    }

    const districtId = await resolveDistrictId(district_name);
    const code = `EXP-${Date.now().toString(36).toUpperCase()}`;

    const { rows } = await db.query(
      `INSERT INTO exporters
        (exporter_code, name, email, phone, license_number, contact_person,
         district_id, commodities, primary_destination, registered_via, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending') RETURNING *`,
      [code, name, email, phone, license_number, contact_person,
        districtId, commodities, primary_destination, registered_via || 'web']
    );
    const exporter = rows[0];

    if (channel && phone) {
      await db.query(
        `INSERT INTO channel_registrations (entity_type, entity_id, channel, phone, verified)
         VALUES ('exporter', $1, $2, $3, false)`,
        [exporter.id, channel, phone]
      );
    }

    await db.query(
      `INSERT INTO sms_alerts (recipient_phone, recipient_type, exporter_id, message, alert_type, status, sent_at)
       VALUES ($1,'exporter',$2,$3,'registration','sent',NOW())`,
      [phone, exporter.id, `MAAIF EUDR: Exporter ${name} registered (${code}). Pending license verification.`]
    );

    await invalidateDataCaches();
    res.status(201).json({ exporter, message: 'Exporter registration submitted for verification' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/districts', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id, name, region FROM districts ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
