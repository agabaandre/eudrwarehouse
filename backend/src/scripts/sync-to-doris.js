const db = require('../db/postgres');
const doris = require('../db/doris');
const { runWarehouseSync } = require('../services/warehouse');

async function syncToDoris() {
  const result = await runWarehouseSync();
  if (result.success) {
    console.log('Modern data warehouse sync completed:', result.tables.join(', '));
  } else {
    console.log('Skipping warehouse sync —', result.message);
  }
  return result.success;
}

if (require.main === module) {
  syncToDoris()
    .then((ok) => process.exit(ok ? 0 : 1))
    .catch((err) => {
      console.error('Warehouse sync failed:', err);
      process.exit(1);
    });
}

module.exports = { syncToDoris };
