const express = require('express');
const db = require('../db/postgres');
const doris = require('../db/doris');

const router = express.Router();

async function queryAnalytics(sql, params, dorisSql) {
  if (doris.isAvailable() && dorisSql) {
    const rows = await doris.query(dorisSql);
    if (rows) return { source: 'apache_doris', data: rows };
  }
  const { rows } = await db.query(sql, params);
  return { source: 'postgresql', data: rows };
}

router.get('/kpis', async (req, res) => {
  try {
    const [{ rows: farmerCount }, { rows: plotCount }, { rows: compliance }, { rows: districts }] = await Promise.all([
      db.query('SELECT COUNT(*)::int AS count FROM farmers'),
      db.query('SELECT COUNT(*)::int AS count FROM farm_plots'),
      db.query(`SELECT status, COUNT(*)::int AS count FROM compliance_records GROUP BY status`),
      db.query('SELECT COUNT(*)::int AS count FROM districts'),
    ]);
    const statusMap = Object.fromEntries(compliance.map((r) => [r.status, r.count]));
    const totalCompliance = compliance.reduce((s, r) => s + r.count, 0);
    res.json({
      total_farmers: 2847500,
      total_farm_plots: 3124800,
      total_area_hectares: 1850000,
      compliant_farms: statusMap.compliant || 2421000,
      non_compliant_farms: statusMap.non_compliant || 284750,
      pending_review: statusMap.pending || 141750,
      compliance_rate: 85,
      total_coffee_exported_tons: 4800000,
      export_value_ugx_trillion: 12.5,
      active_exporters: 347,
      districts_covered: districts[0].count,
      districts_total: 146,
      registered_farmers_db: farmerCount[0].count,
      mapped_plots_db: plotCount[0].count,
      demo_scale_factor: 'National figures scaled for demonstration',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/compliance-overview', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT status, COUNT(*)::int AS count FROM compliance_records GROUP BY status
    `);
    const demo = [
      { status: 'compliant', count: 2421000, percentage: 85 },
      { status: 'non_compliant', count: 284750, percentage: 10 },
      { status: 'pending', count: 141750, percentage: 5 },
    ];
    res.json({ data: demo, db_sample: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/compliance-trend', async (req, res) => {
  try {
    const result = await queryAnalytics(
      'SELECT * FROM compliance_trends ORDER BY year, month',
      [],
      'SELECT year, month, compliant_pct, non_compliant_pct, pending_pct, cumulative_compliant FROM compliance_analytics ORDER BY year, month'
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/district-performance', async (req, res) => {
  try {
    const { region } = req.query;
    let sql = 'SELECT * FROM districts';
    const params = [];
    if (region) { params.push(region); sql += ' WHERE region ILIKE $1'; }
    sql += ' ORDER BY compliance_rate DESC';
    const result = await queryAnalytics(sql, params, `SELECT * FROM district_analytics ORDER BY compliance_rate DESC`);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/production-trends', async (req, res) => {
  try {
    const { year = 2025 } = req.query;
    const { rows: monthly } = await db.query(
      `SELECT month, commodity, production_tons FROM production_stats
       WHERE year = $1 AND district_id IS NULL ORDER BY month, commodity`,
      [year]
    );
    const { rows: annual } = await db.query(
      `SELECT d.name AS district, ps.year, SUM(ps.production_tons) AS production_tons
       FROM production_stats ps JOIN districts d ON ps.district_id = d.id
       WHERE ps.year >= 2021 GROUP BY d.name, ps.year ORDER BY d.name, ps.year`
    );
    res.json({ monthly, annual_by_district: annual });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export-performance', async (req, res) => {
  try {
    const { rows: destinations } = await db.query(
      'SELECT destination_country, volume_tons, value_ugx_b FROM export_stats WHERE year = 2025 ORDER BY volume_tons DESC'
    );
    const { rows: exporters } = await db.query(
      'SELECT name, volume_tons, compliance_rate, export_value_ugx, primary_destination FROM exporters ORDER BY volume_tons DESC'
    );
    res.json({ destinations, exporters });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/risk-heatmap', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT name AS district, risk_score, compliance_rate, total_farms FROM districts ORDER BY risk_score DESC'
    );
    const data = rows.map((r) => ({
      ...r,
      risk_category: r.risk_score <= 30 ? 'low' : r.risk_score <= 60 ? 'medium' : 'high',
      farms_at_risk: Math.round(r.total_farms * (100 - r.compliance_rate) / 100),
    }));
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/farmer-demographics', async (req, res) => {
  res.json({
    age_distribution: [
      { group: '18-25', count: 284750, percentage: 10 },
      { group: '26-35', count: 712000, percentage: 25 },
      { group: '36-45', count: 998000, percentage: 35 },
      { group: '46-55', count: 569500, percentage: 20 },
      { group: '55+', count: 284750, percentage: 10 },
    ],
    gender_distribution: [
      { gender: 'Male', count: 1680000, percentage: 59 },
      { gender: 'Female', count: 1167500, percentage: 41 },
    ],
    farm_size_distribution: [
      { size: '< 0.5 ha', count: 624960, percentage: 20 },
      { size: '0.5 - 1 ha', count: 1249920, percentage: 40 },
      { size: '1 - 2 ha', count: 937440, percentage: 30 },
      { size: '2 - 5 ha', count: 249984, percentage: 8 },
      { size: '> 5 ha', count: 62496, percentage: 2 },
    ],
  });
});

router.get('/map-farms', async (req, res) => {
  const demoFarms = [
    { plot_code: 'F-001', latitude: -1.2489, longitude: 29.9856, commodity: 'coffee', farmer_name: 'John Mwenda', district: 'Kabale', compliance_status: 'compliant', risk_score: 15 },
    { plot_code: 'F-002', latitude: 1.0821, longitude: 34.175, commodity: 'coffee', farmer_name: 'Grace Nambi', district: 'Mbale', compliance_status: 'compliant', risk_score: 15 },
    { plot_code: 'F-003', latitude: 2.5345, longitude: 34.6789, commodity: 'coffee', farmer_name: 'Joseph Okello', district: 'Moroto', compliance_status: 'non_compliant', risk_score: 75 },
    { plot_code: 'F-004', latitude: 0.7111, longitude: 30.0644, commodity: 'cocoa', farmer_name: 'Sarah Kyomugisha', district: 'Bundibugyo', compliance_status: 'pending', risk_score: 40 },
    { plot_code: 'F-005', latitude: -0.3342, longitude: 31.7363, commodity: 'coffee', farmer_name: 'Peter Wasswa', district: 'Masaka', compliance_status: 'compliant', risk_score: 15 },
    { plot_code: 'F-006', latitude: 1.715, longitude: 33.6111, commodity: 'coffee', farmer_name: 'Alice Amongin', district: 'Soroti', compliance_status: 'pending', risk_score: 40 },
    { plot_code: 'F-007', latitude: 1.4, longitude: 34.45, commodity: 'coffee', farmer_name: 'Robert Kato', district: 'Kapchorwa', compliance_status: 'compliant', risk_score: 15 },
    { plot_code: 'F-008', latitude: 3.02, longitude: 34.12, commodity: 'coffee', farmer_name: 'Fatuma Hussein', district: 'Kotido', compliance_status: 'non_compliant', risk_score: 75 },
    { plot_code: 'F-009', latitude: 2.78, longitude: 32.3, commodity: 'cocoa', farmer_name: 'Moses Ochieng', district: 'Gulu', compliance_status: 'compliant', risk_score: 15 },
    { plot_code: 'F-010', latitude: 0.36, longitude: 32.75, commodity: 'coffee', farmer_name: 'Edith Nankya', district: 'Mukono', compliance_status: 'compliant', risk_score: 15 },
    { plot_code: 'F-011', latitude: -0.607, longitude: 30.654, commodity: 'coffee', farmer_name: 'James Tumusiime', district: 'Mbarara', compliance_status: 'compliant', risk_score: 18 },
    { plot_code: 'F-012', latitude: 0.183, longitude: 30.083, commodity: 'coffee', farmer_name: 'Betty Kansiime', district: 'Kasese', compliance_status: 'compliant', risk_score: 18 },
    { plot_code: 'MOR-0012', latitude: 2.5056, longitude: 34.6784, commodity: 'coffee', farmer_name: 'Lokiru Peter', district: 'Moroto', compliance_status: 'non_compliant', risk_score: 82 },
    { plot_code: 'MOR-0045', latitude: 2.5482, longitude: 34.6521, commodity: 'coffee', farmer_name: 'Nakiru Grace', district: 'Moroto', compliance_status: 'non_compliant', risk_score: 78 },
    { plot_code: 'F-024', latitude: -1.26, longitude: 29.99, commodity: 'coffee', farmer_name: 'Ruth Kyalimpa', district: 'Kabale', compliance_status: 'compliant', risk_score: 15 },
  ];

  try {
    const { rows } = await db.query(`
      SELECT fp.plot_code, fp.latitude, fp.longitude, fp.commodity,
             f.name AS farmer_name, d.name AS district, cr.status AS compliance_status, cr.risk_score
      FROM farm_plots fp
      LEFT JOIN farmers f ON fp.farmer_id = f.id
      LEFT JOIN districts d ON fp.district_id = d.id
      LEFT JOIN compliance_records cr ON cr.farm_plot_id = fp.id
      WHERE fp.latitude IS NOT NULL
    `);
    res.json({ data: rows.length ? rows : demoFarms });
  } catch (err) {
    res.json({ data: demoFarms, demo: true, error: err.message });
  }
});

router.get('/regional-distribution', async (req, res) => {
  res.json({
    data: [
      { region: 'Central', farmers: 712000, farm_plots: 781000, compliance_rate: 87 },
      { region: 'Eastern', farmers: 698000, farm_plots: 765000, compliance_rate: 86 },
      { region: 'Western', farmers: 712000, farm_plots: 781000, compliance_rate: 85 },
      { region: 'Northern', farmers: 725500, farm_plots: 797800, compliance_rate: 82 },
    ],
  });
});

router.get('/alerts', async (req, res) => {
  res.json({
    data: [
      { type: 'Compliance Deadline', message: 'EUDR enforcement begins in 30 days', priority: 'high' },
      { type: 'Data Sync Failure', message: 'Abi data sync failed – retry scheduled', priority: 'medium' },
      { type: 'High Risk Detection', message: '1,200 farms in Moroto district identified as high risk', priority: 'high' },
      { type: 'Training Reminder', message: 'District officer training in Kabale – 5 days remaining', priority: 'low' },
      { type: 'Exporter Report Ready', message: 'Monthly compliance report for exporters available', priority: 'low' },
    ],
  });
});

router.get('/custom-report', async (req, res) => {
  try {
    const { region, district, crop } = req.query;
    let sql = 'SELECT d.name AS district, d.region, d.compliance_rate, d.risk_score FROM districts d WHERE 1=1';
    const params = [];
    if (region) { params.push(region); sql += ` AND d.region ILIKE $${params.length}`; }
    if (district) { params.push(`%${district}%`); sql += ` AND d.name ILIKE $${params.length}`; }
    sql += ' ORDER BY d.compliance_rate DESC';
    const { rows } = await db.query(sql, params);
    res.json({ filters: { region, district, crop }, data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/warehouse-status', async (req, res) => {
  res.json({
    postgresql: 'connected',
    apache_doris: doris.isAvailable() ? 'connected' : 'unavailable',
    note: 'Analytics fall back to PostgreSQL when Doris is unavailable',
  });
});

module.exports = router;
