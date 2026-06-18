const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensorController');

// Route untuk mendapatkan data dummy (harus ditaruh di atas route dinamis/tertentu jika ada konflik)
router.get('/dummy', sensorController.getDummyReading);

// Route untuk mendapatkan data terbaru (harus di atas router GET utama/id jika ada)
router.get('/latest', sensorController.getLatestReading);

// Route untuk mendapatkan data statistik agregasi (avg, min, max)
router.get('/stats', sensorController.getStats);

// Route untuk menyimpan data sensor baru (dari ESP32 Gateway)
router.post('/', sensorController.createReading);

// Route untuk mendapatkan semua data sensor (historis) dengan query limit
router.get('/', sensorController.getAllReadings);

module.exports = router;
