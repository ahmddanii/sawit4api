const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');

// GET /api/config/:device_id -> Ambil config untuk device tertentu
router.get('/config/:device_id', configController.getConfig);

// POST /api/config -> Buat config baru
router.post('/config', configController.createConfig);

// PUT /api/config/:device_id -> Update config dari dashboard
router.put('/config/:device_id', configController.updateConfig);

module.exports = router;
