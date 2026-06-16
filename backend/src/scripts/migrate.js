const db = require('../db/postgres');

const migrations = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS districts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  region VARCHAR(50),
  compliance_rate DECIMAL(5,2),
  risk_score INTEGER,
  total_farms INTEGER DEFAULT 0,
  production_tons DECIMAL(12,2) DEFAULT 0,
  export_value_ugx_b DECIMAL(12,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS farmers (
  id SERIAL PRIMARY KEY,
  farmer_code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  gender VARCHAR(20),
  age_group VARCHAR(20),
  phone VARCHAR(50),
  district_id INTEGER REFERENCES districts(id),
  sub_county VARCHAR(100),
  registered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS farm_plots (
  id SERIAL PRIMARY KEY,
  plot_code VARCHAR(50) UNIQUE NOT NULL,
  farmer_id INTEGER REFERENCES farmers(id),
  district_id INTEGER REFERENCES districts(id),
  sub_county VARCHAR(100),
  commodity VARCHAR(50) DEFAULT 'coffee',
  area_hectares DECIMAL(10,4),
  latitude DECIMAL(10,6),
  longitude DECIMAL(10,6),
  farm_size_category VARCHAR(50),
  mapped_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compliance_records (
  id SERIAL PRIMARY KEY,
  farm_plot_id INTEGER REFERENCES farm_plots(id),
  status VARCHAR(30) NOT NULL,
  risk_score INTEGER DEFAULT 0,
  risk_category VARCHAR(20),
  certification_type VARCHAR(100),
  non_compliance_reason VARCHAR(255),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exporters (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  volume_tons DECIMAL(12,2),
  compliance_rate DECIMAL(5,2),
  export_value_ugx DECIMAL(15,2),
  primary_destination VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS production_stats (
  id SERIAL PRIMARY KEY,
  year INTEGER,
  month INTEGER,
  district_id INTEGER REFERENCES districts(id),
  commodity VARCHAR(50),
  production_tons DECIMAL(12,2)
);

CREATE TABLE IF NOT EXISTS export_stats (
  id SERIAL PRIMARY KEY,
  year INTEGER,
  month INTEGER,
  commodity VARCHAR(50),
  destination_country VARCHAR(100),
  volume_tons DECIMAL(12,2),
  value_ugx_b DECIMAL(12,2)
);

CREATE TABLE IF NOT EXISTS compliance_trends (
  id SERIAL PRIMARY KEY,
  year INTEGER,
  month INTEGER,
  compliant_pct DECIMAL(5,2),
  non_compliant_pct DECIMAL(5,2),
  pending_pct DECIMAL(5,2),
  new_compliant_farms INTEGER,
  cumulative_compliant INTEGER,
  target INTEGER
);

CREATE TABLE IF NOT EXISTS ingestion_logs (
  id SERIAL PRIMARY KEY,
  source_type VARCHAR(20) NOT NULL,
  filename VARCHAR(255),
  records_imported INTEGER DEFAULT 0,
  status VARCHAR(30) DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farmers_district ON farmers(district_id);
CREATE INDEX IF NOT EXISTS idx_farm_plots_district ON farm_plots(district_id);
CREATE INDEX IF NOT EXISTS idx_compliance_status ON compliance_records(status);
CREATE INDEX IF NOT EXISTS idx_production_year ON production_stats(year, month);

-- Registration & supply chain extensions
ALTER TABLE farmers ADD COLUMN IF NOT EXISTS registered_via VARCHAR(20) DEFAULT 'web';
ALTER TABLE farmers ADD COLUMN IF NOT EXISTS sms_alerts_enabled BOOLEAN DEFAULT true;

ALTER TABLE exporters ADD COLUMN IF NOT EXISTS exporter_code VARCHAR(50);
ALTER TABLE exporters ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE exporters ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE exporters ADD COLUMN IF NOT EXISTS license_number VARCHAR(100);
ALTER TABLE exporters ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255);
ALTER TABLE exporters ADD COLUMN IF NOT EXISTS district_id INTEGER REFERENCES districts(id);
ALTER TABLE exporters ADD COLUMN IF NOT EXISTS commodities VARCHAR(255);
ALTER TABLE exporters ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active';
ALTER TABLE exporters ADD COLUMN IF NOT EXISTS registered_via VARCHAR(20) DEFAULT 'web';
ALTER TABLE exporters ADD COLUMN IF NOT EXISTS registered_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS supply_chain_links (
  id SERIAL PRIMARY KEY,
  farmer_id INTEGER REFERENCES farmers(id),
  exporter_id INTEGER REFERENCES exporters(id),
  commodity VARCHAR(50) DEFAULT 'coffee',
  volume_kg DECIMAL(12,2),
  batch_code VARCHAR(50),
  link_status VARCHAR(30) DEFAULT 'active',
  compliance_verified BOOLEAN DEFAULT false,
  season VARCHAR(20),
  linked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS channel_registrations (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(20) NOT NULL,
  entity_id INTEGER NOT NULL,
  channel VARCHAR(20) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  is_primary BOOLEAN DEFAULT true,
  verified BOOLEAN DEFAULT false,
  registered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS training_modules (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  video_url VARCHAR(500),
  duration_minutes INTEGER,
  skill_level VARCHAR(20),
  target_audience VARCHAR(20) DEFAULT 'farmer',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS training_enrollments (
  id SERIAL PRIMARY KEY,
  farmer_id INTEGER REFERENCES farmers(id),
  exporter_id INTEGER REFERENCES exporters(id),
  module_id INTEGER REFERENCES training_modules(id),
  progress_pct INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  enrolled_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sms_alerts (
  id SERIAL PRIMARY KEY,
  recipient_phone VARCHAR(50) NOT NULL,
  recipient_type VARCHAR(20) NOT NULL,
  farmer_id INTEGER REFERENCES farmers(id),
  exporter_id INTEGER REFERENCES exporters(id),
  message TEXT NOT NULL,
  alert_type VARCHAR(50),
  status VARCHAR(20) DEFAULT 'queued',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_exporters_code ON exporters(exporter_code) WHERE exporter_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supply_chain_farmer ON supply_chain_links(farmer_id);
CREATE INDEX IF NOT EXISTS idx_supply_chain_exporter ON supply_chain_links(exporter_id);
CREATE INDEX IF NOT EXISTS idx_sms_alerts_status ON sms_alerts(status);
`;

async function migrate() {
  await db.query(migrations);
  console.log('Database migrations completed');
}

if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = { migrate };
