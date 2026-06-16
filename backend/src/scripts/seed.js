const bcrypt = require('bcryptjs');
const db = require('../db/postgres');
const config = require('../config');
const { seedRegistration } = require('./seed-registration');
const { seedExtraData } = require('./seed-extra-data');

const districts = [
  { name: 'Kabale', region: 'Western', compliance_rate: 97.8, risk_score: 12, total_farms: 62500, production_tons: 56400, export_value_ugx_b: 168 },
  { name: 'Kapchorwa', region: 'Eastern', compliance_rate: 98.5, risk_score: 18, total_farms: 45200, production_tons: 39500, export_value_ugx_b: 118 },
  { name: 'Mbale', region: 'Eastern', compliance_rate: 96.2, risk_score: 25, total_farms: 78300, production_tons: 52300, export_value_ugx_b: 156 },
  { name: 'Kisoro', region: 'Western', compliance_rate: 95.5, risk_score: 15, total_farms: 38900, production_tons: 34200, export_value_ugx_b: 102 },
  { name: 'Bundibugyo', region: 'Western', compliance_rate: 94.8, risk_score: 35, total_farms: 52100, production_tons: 42200, export_value_ugx_b: 126 },
  { name: 'Masaka', region: 'Central', compliance_rate: 93.2, risk_score: 22, total_farms: 89400, production_tons: 49100, export_value_ugx_b: 146 },
  { name: 'Mukono', region: 'Central', compliance_rate: 91.8, risk_score: 28, total_farms: 41500, production_tons: 30100, export_value_ugx_b: 90 },
  { name: 'Jinja', region: 'Eastern', compliance_rate: 92.5, risk_score: 20, total_farms: 34200, production_tons: 26800, export_value_ugx_b: 80 },
  { name: 'Soroti', region: 'Eastern', compliance_rate: 90.3, risk_score: 32, total_farms: 28600, production_tons: 23800, export_value_ugx_b: 71 },
  { name: 'Gulu', region: 'Northern', compliance_rate: 89.7, risk_score: 30, total_farms: 22300, production_tons: 20500, export_value_ugx_b: 61 },
  { name: 'Moroto', region: 'Northern', compliance_rate: 62.3, risk_score: 78, total_farms: 18200, production_tons: 13200, export_value_ugx_b: 39 },
  { name: 'Kotido', region: 'Northern', compliance_rate: 65.1, risk_score: 72, total_farms: 15800, production_tons: 10500, export_value_ugx_b: 31 },
  { name: 'Kaabong', region: 'Northern', compliance_rate: 67.4, risk_score: 68, total_farms: 14500, production_tons: 9200, export_value_ugx_b: 27 },
  { name: 'Nakapiripirit', region: 'Northern', compliance_rate: 68.2, risk_score: 65, total_farms: 12900, production_tons: 8500, export_value_ugx_b: 25 },
  { name: 'Amudat', region: 'Northern', compliance_rate: 69.5, risk_score: 62, total_farms: 11300, production_tons: 7800, export_value_ugx_b: 23 },
  { name: 'Pader', region: 'Northern', compliance_rate: 71.3, risk_score: 58, total_farms: 16200, production_tons: 12500, export_value_ugx_b: 37 },
  { name: 'Agago', region: 'Northern', compliance_rate: 72.8, risk_score: 55, total_farms: 14100, production_tons: 11200, export_value_ugx_b: 33 },
  { name: 'Kitgum', region: 'Northern', compliance_rate: 73.5, risk_score: 52, total_farms: 19400, production_tons: 14800, export_value_ugx_b: 44 },
  { name: 'Lamwo', region: 'Northern', compliance_rate: 74.2, risk_score: 50, total_farms: 13800, production_tons: 10800, export_value_ugx_b: 32 },
  { name: 'Nwoya', region: 'Northern', compliance_rate: 75.1, risk_score: 48, total_farms: 10500, production_tons: 8200, export_value_ugx_b: 24 },
];

const sampleFarms = [
  { code: 'F-001', farmer: 'John Mwenda', district: 'Kabale', lat: -1.2489, lng: 29.9856, status: 'compliant', commodity: 'coffee' },
  { code: 'F-002', farmer: 'Grace Nambi', district: 'Mbale', lat: 1.0821, lng: 34.1750, status: 'compliant', commodity: 'coffee' },
  { code: 'F-003', farmer: 'Joseph Okello', district: 'Moroto', lat: 2.5345, lng: 34.6789, status: 'non_compliant', commodity: 'coffee' },
  { code: 'F-004', farmer: 'Sarah Kyomugisha', district: 'Bundibugyo', lat: 0.7111, lng: 30.0644, status: 'pending', commodity: 'cocoa' },
  { code: 'F-005', farmer: 'Peter Wasswa', district: 'Masaka', lat: -0.3342, lng: 31.7363, status: 'compliant', commodity: 'coffee' },
  { code: 'F-006', farmer: 'Alice Amongin', district: 'Soroti', lat: 1.7150, lng: 33.6111, status: 'pending', commodity: 'coffee' },
  { code: 'F-007', farmer: 'Robert Kato', district: 'Kapchorwa', lat: 1.4000, lng: 34.4500, status: 'compliant', commodity: 'coffee' },
  { code: 'F-008', farmer: 'Fatuma Hussein', district: 'Kotido', lat: 3.0200, lng: 34.1200, status: 'non_compliant', commodity: 'coffee' },
  { code: 'F-009', farmer: 'Moses Ochieng', district: 'Gulu', lat: 2.7800, lng: 32.3000, status: 'compliant', commodity: 'cocoa' },
  { code: 'F-010', farmer: 'Edith Nankya', district: 'Mukono', lat: 0.3600, lng: 32.7500, status: 'compliant', commodity: 'coffee' },
];

const morotoNonCompliant = [
  { code: 'MOR-0012', farmer: 'Lokiru Peter', sub: 'Moroto Central', risk: 82, reason: 'Overlap with Forest Reserve' },
  { code: 'MOR-0045', farmer: 'Nakiru Grace', sub: 'Nadunget', risk: 78, reason: 'Overlap with Forest Reserve' },
  { code: 'MOR-0089', farmer: 'Longole Joseph', sub: 'Rupa', risk: 75, reason: 'Incomplete Polygon Data' },
  { code: 'MOR-0123', farmer: 'Aporu Mary', sub: 'Katikekile', risk: 71, reason: 'Overlap with Forest Reserve' },
  { code: 'MOR-0156', farmer: 'Lolem James', sub: 'Northern Division', risk: 68, reason: 'Incomplete Polygon Data' },
];

const exporters = [
  { name: 'Uganda Coffee Exporters Ltd', volume: 850000, rate: 98, value: 2.2e12, dest: 'Germany' },
  { name: 'Kyagalanyi Coffee Ltd', volume: 720000, rate: 97, value: 1.9e12, dest: 'Italy' },
  { name: 'Great Lakes Coffee Ltd', volume: 610000, rate: 96, value: 1.6e12, dest: 'Belgium' },
  { name: 'Tropical Coffee Ltd', volume: 580000, rate: 95, value: 1.5e12, dest: 'Spain' },
  { name: 'Nile Coffee Traders', volume: 490000, rate: 94, value: 1.3e12, dest: 'Netherlands' },
];

const monthlyProduction2025 = [
  [1, 32500, 4200], [2, 35200, 4500], [3, 38500, 4800], [4, 41200, 5100],
  [5, 44500, 5500], [6, 47800, 5800], [7, 45200, 5600], [8, 42500, 5300],
  [9, 39800, 5000], [10, 36500, 4600], [11, 42500, 5200], [12, 51200, 6200],
];

const complianceTrends = [
  [2025, 1, 65, 25, 10], [2025, 2, 68, 23, 9], [2025, 3, 70, 22, 8],
  [2025, 4, 72, 21, 7], [2025, 5, 74, 20, 6], [2025, 6, 76, 19, 5],
  [2025, 7, 78, 18, 4], [2025, 8, 80, 17, 3], [2025, 9, 82, 16, 2],
  [2025, 10, 83, 15, 2], [2025, 11, 84, 14, 2], [2025, 12, 85, 10, 5],
];

const cumulativeCompliance = [
  [45000, 2010000, 2250000], [42000, 2052000, 2300000], [48000, 2100000, 2350000],
  [52000, 2152000, 2400000], [55000, 2207000, 2450000], [58000, 2265000, 2500000],
  [52000, 2317000, 2550000], [45000, 2362000, 2600000], [48000, 2410000, 2650000],
  [50000, 2460000, 2700000], [-39000, 2421000, 2750000], [0, 2421000, 2800000],
];

async function seed() {
  const { rows: existing } = await db.query('SELECT COUNT(*)::int AS c FROM districts');
  if (existing[0].c > 0) {
    console.log('Database already seeded, skipping');
  } else {
    const hash = await bcrypt.hash(config.admin.password, 10);
    await db.query(
    'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)',
    [config.admin.email, hash, 'admin']
  );

  const districtMap = {};
  for (const d of districts) {
    const { rows } = await db.query(
      `INSERT INTO districts (name, region, compliance_rate, risk_score, total_farms, production_tons, export_value_ugx_b)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [d.name, d.region, d.compliance_rate, d.risk_score, d.total_farms, d.production_tons, d.export_value_ugx_b]
    );
    districtMap[d.name] = rows[0].id;
  }

  for (const e of exporters) {
    await db.query(
      'INSERT INTO exporters (name, volume_tons, compliance_rate, export_value_ugx, primary_destination) VALUES ($1,$2,$3,$4,$5)',
      [e.name, e.volume, e.rate, e.value, e.dest]
    );
  }

  for (let i = 0; i < complianceTrends.length; i++) {
    const [year, month, comp, nonComp, pend] = complianceTrends[i];
    const [newFarms, cumulative, target] = cumulativeCompliance[i];
    await db.query(
      `INSERT INTO compliance_trends (year, month, compliant_pct, non_compliant_pct, pending_pct, new_compliant_farms, cumulative_compliant, target)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [year, month, comp, nonComp, pend, newFarms, cumulative, target]
    );
  }

  for (const [month, coffee, cocoa] of monthlyProduction2025) {
    await db.query(
      'INSERT INTO production_stats (year, month, commodity, production_tons) VALUES (2025, $1, $2, $3)',
      [month, 'coffee', coffee]
    );
    await db.query(
      'INSERT INTO production_stats (year, month, commodity, production_tons) VALUES (2025, $1, $2, $3)',
      [month, 'cocoa', cocoa]
    );
  }

  const annualByDistrict = {
    Kabale: [42500, 45800, 48200, 52100, 56400],
    Mbale: [38200, 41500, 44800, 48500, 52300],
    Masaka: [35800, 38200, 41500, 45200, 49100],
    Bundibugyo: [28500, 31200, 34800, 38500, 42200],
    Kapchorwa: [25400, 28100, 31500, 35200, 39500],
    Kisoro: [22300, 24800, 27500, 30800, 34200],
    Mukono: [18500, 20800, 23500, 26800, 30100],
    Jinja: [15200, 17500, 20200, 23500, 26800],
    Soroti: [12800, 14500, 17200, 20500, 23800],
    Gulu: [10500, 12200, 14800, 17500, 20500],
    Moroto: [5200, 6500, 8200, 10500, 13200],
  };

  for (const [districtName, yearly] of Object.entries(annualByDistrict)) {
    const districtId = districtMap[districtName];
    if (!districtId) continue;
    for (let idx = 0; idx < yearly.length; idx++) {
      await db.query(
        'INSERT INTO production_stats (year, district_id, commodity, production_tons) VALUES ($1,$2,$3,$4)',
        [2021 + idx, districtId, 'coffee', yearly[idx]]
      );
    }
  }

  const destinations = [
    ['Germany', 850000, 21, 2500], ['Italy', 720000, 18, 2100], ['Belgium', 580000, 15, 1700],
    ['Spain', 480000, 12, 1400], ['Netherlands', 420000, 10, 1200], ['France', 350000, 9, 1000],
    ['United Kingdom', 250000, 6, 700], ['United States', 200000, 5, 580], ['Others', 160000, 4, 420],
  ];
  for (const [country, vol, , val] of destinations) {
    await db.query(
      'INSERT INTO export_stats (year, commodity, destination_country, volume_tons, value_ugx_b) VALUES (2025, $1, $2, $3, $4)',
      ['coffee', country, vol, val]
    );
  }

  async function createFarm(plot, extra = {}) {
    const districtId = districtMap[plot.district];
    const { rows: farmerRows } = await db.query(
      `INSERT INTO farmers (farmer_code, name, gender, age_group, district_id, sub_county)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [plot.code, plot.farmer, extra.gender || 'male', extra.age || '36-45', districtId, plot.sub || `${plot.district} Central`]
    );
    const { rows: plotRows } = await db.query(
      `INSERT INTO farm_plots (plot_code, farmer_id, district_id, sub_county, commodity, area_hectares, latitude, longitude)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [plot.code, farmerRows[0].id, districtId, plot.sub || `${plot.district} Central`, plot.commodity || 'coffee', extra.area || 1.2, plot.lat, plot.lng]
    );
    const riskCat = plot.status === 'non_compliant' ? 'high' : plot.status === 'pending' ? 'medium' : 'low';
    const riskScore = extra.risk || (plot.status === 'non_compliant' ? 75 : plot.status === 'pending' ? 40 : 15);
    await db.query(
      `INSERT INTO compliance_records (farm_plot_id, status, risk_score, risk_category, non_compliance_reason, certification_type)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [plotRows[0].id, plot.status, riskScore, riskCat, extra.reason || null, 'EUDR Compliance Only']
    );
  }

  for (const farm of sampleFarms) await createFarm(farm);
  for (const farm of morotoNonCompliant) {
    await createFarm(
      { code: farm.code, farmer: farm.farmer, district: 'Moroto', lat: 2.5 + Math.random() * 0.1, lng: 34.6 + Math.random() * 0.1, status: 'non_compliant', commodity: 'coffee', sub: farm.sub },
      { risk: farm.risk, reason: farm.reason }
    );
  }

  console.log('Database seeded with EUDR demonstration data');
  }

  await seedRegistration();
  await seedExtraData();
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}

module.exports = { seed };
