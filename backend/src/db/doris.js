const mysql = require('mysql2/promise');
const config = require('../config');

let pool = null;
let available = false;

async function connect() {
  if (process.env.DORIS_SYNC_ON_START !== 'true') {
    console.log('Apache Doris: skipped (warehouse stack not enabled)');
    return false;
  }

  try {
    pool = mysql.createPool({
      host: config.doris.host,
      port: config.doris.port,
      user: config.doris.user,
      password: config.doris.password,
      waitForConnections: true,
      connectionLimit: 5,
      connectTimeout: 10000,
    });
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    available = true;
    console.log('Apache Doris connection established');
    return true;
  } catch (err) {
    available = false;
    console.warn('Apache Doris unavailable, analytics will use PostgreSQL:', err.message);
    return false;
  }
}

async function query(sql, params = []) {
  if (!available || !pool) return null;
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (err) {
    console.warn('Doris query failed:', err.message);
    return null;
  }
}

async function execute(sql) {
  if (!available || !pool) return false;
  try {
    await pool.query(sql);
    return true;
  } catch (err) {
    console.warn('Doris execute failed:', err.message);
    return false;
  }
}

function isAvailable() {
  return available;
}

module.exports = { connect, query, execute, isAvailable };
