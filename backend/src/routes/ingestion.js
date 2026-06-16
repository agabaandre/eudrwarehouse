const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');
const db = require('../db/postgres');
const { authMiddleware } = require('../middleware/auth');
const { invalidateDataCaches } = require('../services/cache');

const router = express.Router();
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({ dest: uploadDir });

async function importFarmers(records) {
  let imported = 0;
  for (const row of records) {
    const code = row.farmer_code || row.code || row.id;
    const name = row.name || row.farmer_name;
    if (!code || !name) continue;
    let districtId = null;
    const districtName = row.district || row.district_name;
    if (districtName) {
      const { rows } = await db.query('SELECT id FROM districts WHERE name ILIKE $1', [districtName]);
      districtId = rows[0]?.id;
    }
    await db.query(
      `INSERT INTO farmers (farmer_code, name, gender, age_group, phone, district_id, sub_county)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (farmer_code) DO NOTHING`,
      [code, name, row.gender, row.age_group, row.phone, districtId, row.sub_county]
    );
    imported++;
  }
  return imported;
}

router.post('/csv', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const content = fs.readFileSync(req.file.path, 'utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true, trim: true });
    const imported = await importFarmers(records);
    await db.query(
      'INSERT INTO ingestion_logs (source_type, filename, records_imported) VALUES ($1,$2,$3)',
      ['csv', req.file.originalname, imported]
    );
    fs.unlinkSync(req.file.path);
    await invalidateDataCaches();
    res.json({ message: 'CSV imported successfully', records_imported: imported });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/excel', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const records = XLSX.utils.sheet_to_json(sheet);
    const imported = await importFarmers(records);
    await db.query(
      'INSERT INTO ingestion_logs (source_type, filename, records_imported) VALUES ($1,$2,$3)',
      ['excel', req.file.originalname, imported]
    );
    fs.unlinkSync(req.file.path);
    await invalidateDataCaches();
    res.json({ message: 'Excel imported successfully', records_imported: imported });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api', authMiddleware, async (req, res) => {
  try {
    const records = Array.isArray(req.body) ? req.body : req.body.records || [req.body];
    const imported = await importFarmers(records);
    await db.query(
      'INSERT INTO ingestion_logs (source_type, records_imported) VALUES ($1,$2)',
      ['api', imported]
    );
    await invalidateDataCaches();
    res.json({ message: 'API data ingested successfully', records_imported: imported });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/logs', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM ingestion_logs ORDER BY created_at DESC LIMIT 50');
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
