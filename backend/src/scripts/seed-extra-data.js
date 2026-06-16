const db = require('../db/postgres');

const extraDistricts = [
  { name: 'Mbarara', region: 'Western', compliance_rate: 94.5, risk_score: 20, total_farms: 67200, production_tons: 48900, export_value_ugx_b: 142 },
  { name: 'Kasese', region: 'Western', compliance_rate: 91.2, risk_score: 28, total_farms: 43800, production_tons: 36500, export_value_ugx_b: 108 },
  { name: 'Hoima', region: 'Western', compliance_rate: 88.6, risk_score: 38, total_farms: 35600, production_tons: 28400, export_value_ugx_b: 84 },
  { name: 'Lira', region: 'Northern', compliance_rate: 86.4, risk_score: 35, total_farms: 31200, production_tons: 25600, export_value_ugx_b: 76 },
  { name: 'Arua', region: 'Northern', compliance_rate: 85.1, risk_score: 32, total_farms: 28900, production_tons: 22100, export_value_ugx_b: 65 },
  { name: 'Kamuli', region: 'Eastern', compliance_rate: 90.8, risk_score: 24, total_farms: 36700, production_tons: 31200, export_value_ugx_b: 92 },
  { name: 'Iganga', region: 'Eastern', compliance_rate: 89.3, risk_score: 26, total_farms: 33400, production_tons: 27800, export_value_ugx_b: 82 },
  { name: 'Tororo', region: 'Eastern', compliance_rate: 87.6, risk_score: 30, total_farms: 29800, production_tons: 24500, export_value_ugx_b: 72 },
  { name: 'Wakiso', region: 'Central', compliance_rate: 92.1, risk_score: 18, total_farms: 52100, production_tons: 38400, export_value_ugx_b: 114 },
  { name: 'Luwero', region: 'Central', compliance_rate: 88.9, risk_score: 22, total_farms: 27600, production_tons: 23200, export_value_ugx_b: 68 },
];

const extraFarms = [
  { code: 'F-011', farmer: 'James Tumusiime', district: 'Mbarara', lat: -0.607, lng: 30.654, status: 'compliant', commodity: 'coffee' },
  { code: 'F-012', farmer: 'Betty Kansiime', district: 'Kasese', lat: 0.183, lng: 30.083, status: 'compliant', commodity: 'coffee' },
  { code: 'F-013', farmer: 'David Opio', district: 'Lira', lat: 2.250, lng: 32.900, status: 'pending', commodity: 'cocoa' },
  { code: 'F-014', farmer: 'Rose Akello', district: 'Arua', lat: 3.020, lng: 30.910, status: 'compliant', commodity: 'coffee' },
  { code: 'F-015', farmer: 'Moses Waiswa', district: 'Wakiso', lat: 0.404, lng: 32.459, status: 'compliant', commodity: 'coffee' },
  { code: 'F-016', farmer: 'Sarah Nalubega', district: 'Luwero', lat: 0.833, lng: 32.473, status: 'compliant', commodity: 'coffee' },
  { code: 'F-017', farmer: 'Peter Okurut', district: 'Tororo', lat: 0.693, lng: 34.181, status: 'pending', commodity: 'cocoa' },
  { code: 'F-018', farmer: 'Agnes Nabirye', district: 'Kamuli', lat: 0.947, lng: 33.120, status: 'compliant', commodity: 'coffee' },
  { code: 'F-019', farmer: 'Henry Mugisha', district: 'Hoima', lat: 1.431, lng: 31.352, status: 'non_compliant', commodity: 'coffee' },
  { code: 'F-020', farmer: 'Jane Achieng', district: 'Iganga', lat: 0.609, lng: 33.469, status: 'compliant', commodity: 'cocoa' },
  { code: 'F-021', farmer: 'Robert Ssemakula', district: 'Mbarara', lat: -0.620, lng: 30.675, status: 'compliant', commodity: 'coffee' },
  { code: 'F-022', farmer: 'Faith Amongin', district: 'Soroti', lat: 1.715, lng: 33.611, status: 'compliant', commodity: 'coffee' },
  { code: 'F-023', farmer: 'Emmanuel Okello', district: 'Gulu', lat: 2.780, lng: 32.300, status: 'pending', commodity: 'cocoa' },
  { code: 'F-024', farmer: 'Ruth Kyalimpa', district: 'Kabale', lat: -1.260, lng: 29.990, status: 'compliant', commodity: 'coffee' },
  { code: 'F-025', farmer: 'Ibrahim Ssebunya', district: 'Masaka', lat: -0.340, lng: 31.740, status: 'compliant', commodity: 'coffee' },
];

async function seedExtraData() {
  const districtMap = {};
  const { rows: existing } = await db.query('SELECT id, name FROM districts');
  existing.forEach((d) => { districtMap[d.name] = d.id; });

  for (const d of extraDistricts) {
    if (districtMap[d.name]) continue;
    const { rows } = await db.query(
      `INSERT INTO districts (name, region, compliance_rate, risk_score, total_farms, production_tons, export_value_ugx_b)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (name) DO NOTHING RETURNING id`,
      [d.name, d.region, d.compliance_rate, d.risk_score, d.total_farms, d.production_tons, d.export_value_ugx_b]
    );
    if (rows[0]) districtMap[d.name] = rows[0].id;
  }

  const { rows: refreshed } = await db.query('SELECT id, name FROM districts');
  refreshed.forEach((d) => { districtMap[d.name] = d.id; });

  async function createFarm(plot, extra = {}) {
    const { rows: exists } = await db.query('SELECT id FROM farmers WHERE farmer_code = $1', [plot.code]);
    if (exists.length) return;

    const districtId = districtMap[plot.district];
    const { rows: farmerRows } = await db.query(
      `INSERT INTO farmers (farmer_code, name, gender, age_group, phone, district_id, sub_county, registered_via)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'seed') RETURNING id`,
      [plot.code, plot.farmer, extra.gender || 'male', extra.age || '36-45',
        `+256700${Math.floor(200000 + Math.random() * 800000)}`, districtId, `${plot.district} Central`]
    );
    const { rows: plotRows } = await db.query(
      `INSERT INTO farm_plots (plot_code, farmer_id, district_id, sub_county, commodity, area_hectares, latitude, longitude)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [plot.code, farmerRows[0].id, districtId, `${plot.district} Central`, plot.commodity || 'coffee', extra.area || 1.5, plot.lat, plot.lng]
    );
    const riskCat = plot.status === 'non_compliant' ? 'high' : plot.status === 'pending' ? 'medium' : 'low';
    const riskScore = extra.risk || (plot.status === 'non_compliant' ? 72 : plot.status === 'pending' ? 42 : 18);
    await db.query(
      `INSERT INTO compliance_records (farm_plot_id, status, risk_score, risk_category, certification_type)
       VALUES ($1,$2,$3,$4,'EUDR Compliance Only')`,
      [plotRows[0].id, plot.status, riskScore, riskCat]
    );
  }

  for (const farm of extraFarms) await createFarm(farm);

  const { rows: expRows } = await db.query('SELECT id FROM exporters ORDER BY id');
  const { rows: farmRows } = await db.query(
    `SELECT f.id FROM farmers f WHERE f.farmer_code LIKE 'F-0%' ORDER BY f.id`
  );
  if (expRows.length && farmRows.length) {
    const { rows: linkCount } = await db.query('SELECT COUNT(*)::int AS c FROM supply_chain_links');
    if (linkCount[0].c < 15) {
      for (let i = 0; i < Math.min(12, farmRows.length); i++) {
        await db.query(
          `INSERT INTO supply_chain_links (farmer_id, exporter_id, commodity, volume_kg, batch_code, compliance_verified, season)
           SELECT $1, $2, 'coffee', $3, $4, $5, '2025/26'
           WHERE NOT EXISTS (SELECT 1 FROM supply_chain_links WHERE farmer_id = $1 AND batch_code = $4)`,
          [farmRows[i].id, expRows[i % expRows.length].id, 800 + i * 150,
            `BATCH-2025-EXT-${String(i + 1).padStart(3, '0')}`, i % 4 !== 0]
        );
      }
    }
  }

  console.log('Extra districts, farmers, and supply chain data seeded');
}

module.exports = { seedExtraData };
