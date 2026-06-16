const db = require('../db/postgres');
const doris = require('../db/doris');
const config = require('../config');

const STAR_SCHEMA_DDL = [
  `CREATE DATABASE IF NOT EXISTS ${config.doris.database}`,
  `USE ${config.doris.database}`,

  // Dimension: districts
  `CREATE TABLE IF NOT EXISTS dim_district (
    district_key INT,
    district_name VARCHAR(100),
    region VARCHAR(50),
    compliance_rate DECIMAL(5,2),
    risk_score INT,
  risk_category VARCHAR(20),
    total_farms INT,
    production_tons DECIMAL(14,2),
    export_value_ugx_b DECIMAL(14,2),
    latitude DECIMAL(10,6),
    longitude DECIMAL(10,6),
    updated_at DATETIME
  ) UNIQUE KEY(district_key)
  DISTRIBUTED BY HASH(district_key) BUCKETS 1
  PROPERTIES ("replication_num" = "1")`,

  // Dimension: date
  `CREATE TABLE IF NOT EXISTS dim_date (
    date_key INT,
    year INT,
    month INT,
    quarter INT,
    month_name VARCHAR(20),
    year_month VARCHAR(10)
  ) UNIQUE KEY(date_key)
  DISTRIBUTED BY HASH(date_key) BUCKETS 1
  PROPERTIES ("replication_num" = "1")`,

  // Dimension: commodity
  `CREATE TABLE IF NOT EXISTS dim_commodity (
    commodity_key INT,
    commodity_name VARCHAR(50),
    crop_category VARCHAR(50)
  ) UNIQUE KEY(commodity_key)
  DISTRIBUTED BY HASH(commodity_key) BUCKETS 1
  PROPERTIES ("replication_num" = "1")`,

  // Fact: production
  `CREATE TABLE IF NOT EXISTS fact_production (
    date_key INT,
    district_key INT,
    commodity_key INT,
    production_tons DECIMAL(14,2),
    synced_at DATETIME
  ) DUPLICATE KEY(date_key, district_key, commodity_key)
  DISTRIBUTED BY HASH(district_key) BUCKETS 1
  PROPERTIES ("replication_num" = "1")`,

  // Fact: compliance snapshots
  `CREATE TABLE IF NOT EXISTS fact_compliance (
    date_key INT,
    district_key INT,
    compliant_count INT,
    non_compliant_count INT,
    pending_count INT,
    compliance_rate DECIMAL(5,2),
    risk_score INT,
    synced_at DATETIME
  ) DUPLICATE KEY(date_key, district_key)
  DISTRIBUTED BY HASH(district_key) BUCKETS 1
  PROPERTIES ("replication_num" = "1")`,

  // Fact: exports
  `CREATE TABLE IF NOT EXISTS fact_exports (
    date_key INT,
    destination_country VARCHAR(100),
    commodity_key INT,
    volume_tons DECIMAL(14,2),
    value_ugx_b DECIMAL(14,2),
    exporter_name VARCHAR(255),
    compliance_rate DECIMAL(5,2),
    synced_at DATETIME
  ) DUPLICATE KEY(date_key, destination_country, commodity_key)
  DISTRIBUTED BY HASH(destination_country) BUCKETS 1
  PROPERTIES ("replication_num" = "1")`,

  // Fact: farm geospatial & risk
  `CREATE TABLE IF NOT EXISTS fact_farm_geo (
    plot_code VARCHAR(50),
    district_key INT,
    farmer_name VARCHAR(255),
    commodity VARCHAR(50),
    latitude DECIMAL(10,6),
    longitude DECIMAL(10,6),
    compliance_status VARCHAR(30),
    risk_score INT,
    risk_category VARCHAR(20),
    area_hectares DECIMAL(10,4),
    synced_at DATETIME
  ) DUPLICATE KEY(plot_code)
  DISTRIBUTED BY HASH(district_key) BUCKETS 1
  PROPERTIES ("replication_num" = "1")`,

  // Aggregate: regional rollup (modern OLAP summary)
  `CREATE TABLE IF NOT EXISTS agg_regional_summary (
    region VARCHAR(50),
    total_farmers BIGINT,
    total_farm_plots BIGINT,
    avg_compliance_rate DECIMAL(5,2),
    avg_risk_score DECIMAL(5,2),
    total_production_tons DECIMAL(14,2),
    synced_at DATETIME
  ) DUPLICATE KEY(region)
  DISTRIBUTED BY HASH(region) BUCKETS 1
  PROPERTIES ("replication_num" = "1")`,
];

const DISTRICT_COORDS = {
  Kabale: [-1.25, 29.99], Kapchorwa: [1.40, 34.45], Mbale: [1.08, 34.18],
  Kisoro: [-1.29, 29.68], Bundibugyo: [0.71, 30.06], Masaka: [-0.33, 31.74],
  Mukono: [0.36, 32.75], Jinja: [0.43, 33.20], Soroti: [1.72, 33.61],
  Gulu: [2.78, 32.30], Moroto: [2.53, 34.68], Kotido: [3.02, 34.12],
  Kaabong: [3.52, 33.98], Nakapiripirit: [1.91, 34.71], Amudat: [2.82, 34.95],
  Pader: [2.90, 33.04], Agago: [2.98, 33.48], Kitgum: [3.29, 32.88],
  Lamwo: [3.53, 32.80], Nwoya: [2.49, 32.00],
  Mbarara: [-0.61, 30.66], Fort_Portal: [0.67, 30.27], Hoima: [1.43, 31.35],
  Lira: [2.25, 32.90], Arua: [3.03, 30.91], Kasese: [0.18, 30.08],
  Kamuli: [0.95, 33.12], Iganga: [0.61, 33.47], Tororo: [0.69, 34.18],
  Wakiso: [0.40, 32.46], Luwero: [0.85, 32.50], Kasese_: [0.18, 30.08],
};

function riskCategory(score) {
  if (score <= 30) return 'low';
  if (score <= 60) return 'medium';
  return 'high';
}

function esc(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val;
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function setupStarSchema() {
  for (const ddl of STAR_SCHEMA_DDL) {
    await doris.execute(ddl);
  }
}

async function seedDimensions(now) {
  const { rows: districts } = await db.query('SELECT * FROM districts ORDER BY id');
  for (const d of districts) {
    const coords = DISTRICT_COORDS[d.name] || [0, 0];
    await doris.execute(
      `INSERT INTO dim_district VALUES (${d.id},${esc(d.name)},${esc(d.region)},${d.compliance_rate},${d.risk_score},${esc(riskCategory(d.risk_score))},${d.total_farms},${d.production_tons},${d.export_value_ugx_b},${coords[0]},${coords[1]},${esc(now)})`
    );
  }

  const commodities = [
    [1, 'coffee', 'perennial'],
    [2, 'cocoa', 'perennial'],
    [3, 'cotton', 'annual'],
    [4, 'tea', 'perennial'],
  ];
  for (const c of commodities) {
    await doris.execute(`INSERT INTO dim_commodity VALUES (${c[0]},${esc(c[1])},${esc(c[2])})`);
  }

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  for (let y = 2021; y <= 2025; y++) {
    for (let m = 1; m <= 12; m++) {
      const dateKey = y * 100 + m;
      await doris.execute(
        `INSERT INTO dim_date VALUES (${dateKey},${y},${m},${Math.ceil(m/3)},${esc(monthNames[m-1])},${esc(`${y}-${String(m).padStart(2,'0')}`)})`
      );
    }
  }
}

async function syncFacts(now) {
  const { rows: production } = await db.query(`
    SELECT ps.year, ps.month, ps.district_id, ps.commodity, ps.production_tons
    FROM production_stats ps ORDER BY ps.year, ps.month
  `);
  const commodityKeys = { coffee: 1, cocoa: 2 };
  for (const p of production) {
    const dateKey = p.year * 100 + (p.month || 1);
    const districtKey = p.district_id || 0;
    const commodityKey = commodityKeys[p.commodity] || 1;
    await doris.execute(
      `INSERT INTO fact_production VALUES (${dateKey},${districtKey},${commodityKey},${p.production_tons},${esc(now)})`
    );
  }

  const { rows: trends } = await db.query('SELECT * FROM compliance_trends ORDER BY year, month');
  for (const t of trends) {
    const dateKey = t.year * 100 + t.month;
    const { rows: districts } = await db.query('SELECT id, compliance_rate, risk_score, total_farms FROM districts');
    for (const d of districts) {
      const rate = parseFloat(d.compliance_rate) / 100;
      const compliant = Math.round(d.total_farms * rate);
      const nonCompliant = Math.round(d.total_farms * (parseFloat(t.non_compliant_pct) / 100));
      const pending = d.total_farms - compliant - nonCompliant;
      await doris.execute(
        `INSERT INTO fact_compliance VALUES (${dateKey},${d.id},${compliant},${nonCompliant},${pending},${d.compliance_rate},${d.risk_score},${esc(now)})`
      );
    }
  }

  const { rows: exports } = await db.query('SELECT * FROM export_stats');
  for (const e of exports) {
    const dateKey = (e.year || 2025) * 100 + (e.month || 12);
    const commodityKey = e.commodity === 'cocoa' ? 2 : 1;
    await doris.execute(
      `INSERT INTO fact_exports VALUES (${dateKey},${esc(e.destination_country)},${commodityKey},${e.volume_tons},${e.value_ugx_b},NULL,NULL,${esc(now)})`
    );
  }

  const { rows: exporters } = await db.query('SELECT * FROM exporters');
  for (const ex of exporters) {
    await doris.execute(
      `INSERT INTO fact_exports VALUES (202512,${esc(ex.primary_destination)},1,${ex.volume_tons},NULL,${esc(ex.name)},${ex.compliance_rate},${esc(now)})`
    );
  }

  const { rows: farms } = await db.query(`
    SELECT fp.plot_code, fp.district_id, f.name AS farmer_name, fp.commodity,
           fp.latitude, fp.longitude, cr.status, cr.risk_score, cr.risk_category, fp.area_hectares
    FROM farm_plots fp
    LEFT JOIN farmers f ON fp.farmer_id = f.id
    LEFT JOIN compliance_records cr ON cr.farm_plot_id = fp.id
    WHERE fp.latitude IS NOT NULL
  `);
  for (const f of farms) {
    await doris.execute(
      `INSERT INTO fact_farm_geo VALUES (${esc(f.plot_code)},${f.district_id || 0},${esc(f.farmer_name)},${esc(f.commodity)},${f.latitude},${f.longitude},${esc(f.status)},${f.risk_score || 0},${esc(f.risk_category)},${f.area_hectares || 0},${esc(now)})`
    );
  }

  const regional = [
    ['Central', 712000, 781000, 87, 24, 491000],
    ['Eastern', 698000, 765000, 86, 26, 523000],
    ['Western', 712000, 781000, 85, 22, 422000],
    ['Northern', 725500, 797800, 82, 55, 132000],
  ];
  for (const r of regional) {
    await doris.execute(
      `INSERT INTO agg_regional_summary VALUES (${esc(r[0])},${r[1]},${r[2]},${r[3]},${r[4]},${r[5]},${esc(now)})`
    );
  }
}

async function runWarehouseSync() {
  const connected = await doris.connect();
  if (!connected) {
    return { success: false, message: 'Apache Doris unavailable' };
  }

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  await setupStarSchema();
  await seedDimensions(now);
  await syncFacts(now);

  return {
    success: true,
    message: 'Star schema warehouse sync completed',
    tables: [
      'dim_district', 'dim_date', 'dim_commodity',
      'fact_production', 'fact_compliance', 'fact_exports',
      'fact_farm_geo', 'agg_regional_summary',
    ],
    synced_at: now,
  };
}

async function getWarehouseStatus() {
  const dorisUp = doris.isAvailable();
  let tables = [];
  if (dorisUp) {
    const rows = await doris.query(`SHOW TABLES FROM ${config.doris.database}`);
    tables = rows ? rows.map((r) => Object.values(r)[0]) : [];
  }
  return {
    architecture: 'PostgreSQL (OLTP) → ETL → Apache Doris (OLAP star schema) → Apache Superset (BI)',
    postgresql: 'connected',
    apache_doris: dorisUp ? 'connected' : 'unavailable',
    apache_superset: config.superset.url,
    superset_public: config.superset.publicEnabled,
    database: config.doris.database,
    tables,
    star_schema: {
      dimensions: ['dim_district', 'dim_date', 'dim_commodity'],
      facts: ['fact_production', 'fact_compliance', 'fact_exports', 'fact_farm_geo'],
      aggregates: ['agg_regional_summary'],
    },
  };
}

module.exports = { runWarehouseSync, getWarehouseStatus };
