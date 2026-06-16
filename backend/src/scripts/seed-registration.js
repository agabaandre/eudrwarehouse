const db = require('../db/postgres');

const trainingModules = [
  {
    title: 'Introduction to EUDR Compliance',
    description: 'Understand the EU Deforestation Regulation and what it means for Ugandan coffee and cocoa farmers.',
    category: 'compliance',
    video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    duration_minutes: 12,
    skill_level: 'beginner',
    target_audience: 'farmer',
    sort_order: 1,
  },
  {
    title: 'Geospatial Farm Mapping with Mobile GPS',
    description: 'Learn how to map your farm plot using the MAAIF mobile app and submit coordinates for compliance verification.',
    category: 'mobile',
    video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    duration_minutes: 18,
    skill_level: 'intermediate',
    target_audience: 'farmer',
    sort_order: 2,
  },
  {
    title: 'USSD Registration & Status Checks',
    description: 'Step-by-step guide to register via USSD *284# and check your compliance status without internet.',
    category: 'ussd',
    video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    duration_minutes: 8,
    skill_level: 'beginner',
    target_audience: 'farmer',
    sort_order: 3,
  },
  {
    title: 'Exporter Due Diligence & Farmer Traceability',
    description: 'How exporters link farmer batches, verify compliance certificates, and prepare EU due diligence statements.',
    category: 'compliance',
    video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    duration_minutes: 22,
    skill_level: 'advanced',
    target_audience: 'exporter',
    sort_order: 4,
  },
  {
    title: 'SMS Alerts & Seasonal Compliance Reminders',
    description: 'Configure SMS notifications for harvest deadlines, compliance reviews, and export window openings.',
    category: 'alerts',
    video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    duration_minutes: 10,
    skill_level: 'beginner',
    target_audience: 'both',
    sort_order: 5,
  },
  {
    title: 'Sustainable Harvesting & Risk Reduction',
    description: 'Practical skills to reduce deforestation risk scores and maintain EUDR-compliant production.',
    category: 'skills',
    video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    duration_minutes: 25,
    skill_level: 'intermediate',
    target_audience: 'farmer',
    sort_order: 6,
  },
];

async function seedRegistration() {
  const { rows: existing } = await db.query('SELECT COUNT(*)::int AS c FROM training_modules');
  if (existing[0].c > 0) {
    console.log('Registration data already seeded, skipping');
    return;
  }

  const { rows: exporters } = await db.query('SELECT id, name FROM exporters ORDER BY id LIMIT 5');
  const { rows: farmers } = await db.query(
    `SELECT f.id, f.farmer_code, f.name, f.phone, fp.commodity, cr.status
     FROM farmers f
     JOIN farm_plots fp ON fp.farmer_id = f.id
     LEFT JOIN compliance_records cr ON cr.farm_plot_id = fp.id
     ORDER BY f.id LIMIT 12`
  );

  const exporterCodes = ['EXP-001', 'EXP-002', 'EXP-003', 'EXP-004', 'EXP-005'];
  for (let i = 0; i < exporters.length; i++) {
    await db.query(
      `UPDATE exporters SET
        exporter_code = $1, email = $2, phone = $3, license_number = $4,
        contact_person = $5, commodities = $6, registered_via = 'web'
       WHERE id = $7`,
      [
        exporterCodes[i],
        `contact@${exporters[i].name.toLowerCase().replace(/\s+/g, '').slice(0, 20)}.ug`,
        `+256700${100000 + i}`,
        `EUDR-LIC-2025-${String(i + 1).padStart(4, '0')}`,
        'Export Manager',
        'coffee,cocoa',
        exporters[i].id,
      ]
    );
  }

  const linkPairs = [
    [0, 0, 1200, 'BATCH-2025-KAB-001', true],
    [1, 0, 980, 'BATCH-2025-MBL-002', true],
    [2, 2, 450, 'BATCH-2025-MRT-003', false],
    [4, 1, 2100, 'BATCH-2025-MSK-004', true],
    [6, 1, 1650, 'BATCH-2025-KPC-005', true],
    [9, 3, 890, 'BATCH-2025-MKN-006', true],
    [0, 4, 750, 'BATCH-2025-KAB-007', true],
    [1, 2, 1100, 'BATCH-2025-MBL-008', true],
    [4, 0, 3200, 'BATCH-2025-MSK-009', true],
    [6, 4, 1400, 'BATCH-2025-KPC-010', false],
  ];

  for (const [farmerIdx, exporterIdx, volume, batch, verified] of linkPairs) {
    const farmer = farmers[farmerIdx];
    const exporter = exporters[exporterIdx];
    if (!farmer || !exporter) continue;
    await db.query(
      `INSERT INTO supply_chain_links
        (farmer_id, exporter_id, commodity, volume_kg, batch_code, link_status, compliance_verified, season)
       VALUES ($1,$2,$3,$4,$5,'active',$6,'2025/26')`,
      [farmer.id, exporter.id, farmer.commodity || 'coffee', volume, batch, verified]
    );
  }

  for (const mod of trainingModules) {
    await db.query(
      `INSERT INTO training_modules
        (title, description, category, video_url, duration_minutes, skill_level, target_audience, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [mod.title, mod.description, mod.category, mod.video_url, mod.duration_minutes,
        mod.skill_level, mod.target_audience, mod.sort_order]
    );
  }

  const phoneSamples = ['+256700100001', '+256700100002', '+256700100003', '+256700200001'];
  for (let i = 0; i < Math.min(4, farmers.length); i++) {
    const phone = farmers[i].phone || phoneSamples[i];
    await db.query(
      `INSERT INTO channel_registrations (entity_type, entity_id, channel, phone, verified)
       VALUES ('farmer', $1, 'mobile', $2, true)`,
      [farmers[i].id, phone]
    );
    if (i < 2) {
      await db.query(
        `INSERT INTO channel_registrations (entity_type, entity_id, channel, phone, verified)
         VALUES ('farmer', $1, 'ussd', $2, true)`,
        [farmers[i].id, phone]
      );
    }
  }

  for (let i = 0; i < Math.min(3, exporters.length); i++) {
    await db.query(
      `INSERT INTO channel_registrations (entity_type, entity_id, channel, phone, verified)
       VALUES ('exporter', $1, 'mobile', $2, true)`,
      [exporters[i].id, `+256700${300000 + i}`]
    );
  }

  const alerts = [
    { phone: '+256700100001', type: 'farmer', farmerId: farmers[0]?.id, msg: 'EUDR: Your farm F-001 compliance review is complete. Status: COMPLIANT.', alertType: 'compliance' },
    { phone: '+256700100003', type: 'farmer', farmerId: farmers[2]?.id, msg: 'EUDR ALERT: Non-compliance detected on plot MOR-0012. Contact your district officer.', alertType: 'compliance' },
    { phone: '+256700300000', type: 'exporter', exporterId: exporters[0]?.id, msg: 'Export window open: 1,200kg verified coffee batch BATCH-2025-KAB-001 ready for shipment.', alertType: 'export' },
    { phone: '+256700100002', type: 'farmer', farmerId: farmers[1]?.id, msg: 'Training reminder: Complete "Geospatial Farm Mapping" module via Mobile App or USSD *284#.', alertType: 'training' },
  ];

  for (const a of alerts) {
    await db.query(
      `INSERT INTO sms_alerts
        (recipient_phone, recipient_type, farmer_id, exporter_id, message, alert_type, status, sent_at)
       VALUES ($1,$2,$3,$4,$5,$6,'sent',NOW())`,
      [a.phone, a.type, a.farmerId || null, a.exporterId || null, a.msg, a.alertType]
    );
  }

  console.log('Registration, supply chain, training, and alert data seeded');
}

if (require.main === module) {
  seedRegistration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Registration seed failed:', err);
      process.exit(1);
    });
}

module.exports = { seedRegistration };
