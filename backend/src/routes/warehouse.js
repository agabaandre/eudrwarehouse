const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { runWarehouseSync, getWarehouseStatus } = require('../services/warehouse');
const { invalidateDataCaches } = require('../services/cache');

const router = express.Router();

router.get('/status', async (req, res) => {
  try {
    res.json(await getWarehouseStatus());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/sync', authMiddleware, async (req, res) => {
  try {
    const result = await runWarehouseSync();
    await invalidateDataCaches();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
