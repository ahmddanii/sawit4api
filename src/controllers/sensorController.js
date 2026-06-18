const SensorReading = require('../models/SensorReading');
const thresholds = require('../config/threshold');

/**
 * Helper function untuk menghitung status data sensor berdasarkan konfigurasi threshold
 */
const calculateStatus = (ph, tds) => {
  const phStatus = (ph >= thresholds.ph.min && ph <= thresholds.ph.max) ? 'normal' : 'warning';
  const tdsStatus = (tds <= thresholds.tds.max) ? 'normal' : 'warning';
  const overall = (phStatus === 'normal' && tdsStatus === 'normal') ? 'normal' : 'warning';

  return {
    ph: phStatus,
    tds: tdsStatus,
    overall
  };
};

/**
 * Controller untuk mengelola data sensor pH dan TDS
 */

// 1. POST /api/sensor-data
// Menerima data sensor dari Gateway ESP32 dan menyimpannya ke database
exports.createReading = async (req, res) => {
  try {
    const { ph, tds, timestamp, device_id } = req.body;

    // Validasi manual tambahan jika diperlukan
    if (ph === undefined || tds === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Nilai ph dan tds wajib disertakan dalam request body'
      });
    }

    const newReading = new SensorReading({
      ph,
      tds,
      timestamp: timestamp || new Date(),
      device_id: device_id || 'transmitter-01'
    });

    const savedReading = await newReading.save();

    // Hitung status threshold (tidak disimpan di DB, hanya untuk response & socket payload)
    const status = calculateStatus(savedReading.ph, savedReading.tds);

    const responseData = {
      ...savedReading.toObject(),
      status
    };

    // Emit event socket.io 'sensor-update' ke semua client yang terhubung
    const io = req.app.get('socketio');
    if (io) {
      io.emit('sensor-update', responseData);
    }

    res.status(201).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// 2. GET /api/sensor-data
// Mengambil semua data historis sensor, mendukung date range filter, limit, dan pagination
exports.getAllReadings = async (req, res) => {
  try {
    const { from, to } = req.query;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    // Buat filter query
    const filterQuery = {};
    if (from || to) {
      filterQuery.timestamp = {};
      if (from) {
        // Awal hari dari tanggal 'from'
        const fromDate = new Date(from);
        fromDate.setHours(0, 0, 0, 0);
        filterQuery.timestamp.$gte = fromDate;
      }
      if (to) {
        // Akhir hari dari tanggal 'to'
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        filterQuery.timestamp.$lte = toDate;
      }
    }

    // Hitung total data berdasarkan filter
    const totalData = await SensorReading.countDocuments(filterQuery);
    const totalPages = Math.ceil(totalData / limit);

    const readings = await SensorReading.find(filterQuery)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    // Tambahkan kalkulasi status pada tiap entri historis
    const readingsWithStatus = readings.map(item => ({
      ...item.toObject(),
      status: calculateStatus(item.ph, item.tds)
    }));

    res.status(200).json({
      success: true,
      currentPage: page,
      totalPages,
      totalData,
      count: readingsWithStatus.length,
      data: readingsWithStatus
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 3. GET /api/sensor-data/latest
// Mengambil satu data sensor paling terbaru
exports.getLatestReading = async (req, res) => {
  try {
    const latest = await SensorReading.findOne().sort({ timestamp: -1 });

    if (!latest) {
      return res.status(404).json({
        success: false,
        message: 'Belum ada data sensor tersimpan di database'
      });
    }

    // Hitung status threshold
    const status = calculateStatus(latest.ph, latest.tds);

    res.status(200).json({
      success: true,
      data: {
        ...latest.toObject(),
        status
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 4. GET /api/sensor-data/stats
// Mengambil statistik min, max, avg berdasarkan parameter period (today | week | month)
exports.getStats = async (req, res) => {
  try {
    const { period = 'today' } = req.query;
    const now = new Date();
    let startDate = new Date();

    if (period === 'today') {
      startDate.setHours(0, 0, 0, 0); // Mulai dari jam 00:00 hari ini
    } else if (period === 'week') {
      startDate.setDate(now.getDate() - 7); // 7 hari terakhir
    } else if (period === 'month') {
      startDate.setMonth(now.getMonth() - 1); // 1 bulan terakhir
    } else {
      return res.status(400).json({
        success: false,
        message: "Parameter 'period' tidak valid. Gunakan 'today', 'week', atau 'month'."
      });
    }

    const stats = await SensorReading.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          avgPh: { $avg: '$ph' },
          minPh: { $min: '$ph' },
          maxPh: { $max: '$ph' },
          avgTds: { $avg: '$tds' },
          minTds: { $min: '$tds' },
          maxTds: { $max: '$tds' }
        }
      }
    ]);

    // Format response jika data kosong/belum ada sensor tersimpan dalam periode tersebut
    const responseData = stats.length > 0 ? {
      period,
      ph: {
        avg: parseFloat(stats[0].avgPh.toFixed(2)),
        min: parseFloat(stats[0].minPh.toFixed(2)),
        max: parseFloat(stats[0].maxPh.toFixed(2))
      },
      tds: {
        avg: Math.round(stats[0].avgTds),
        min: Math.round(stats[0].minTds),
        max: Math.round(stats[0].maxTds)
      }
    } : {
      period,
      ph: { avg: 0, min: 0, max: 0 },
      tds: { avg: 0, min: 0, max: 0 }
    };

    res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 5. GET /api/sensor-data/dummy
// Mengembalikan data simulasi tanpa menyimpannya ke database
// pH disimulasikan normal & borderline: 6.0 - 8.0
exports.getDummyReading = (req, res) => {
  try {
    const time = Date.now();
    const factor = time / 60000;

    // pH disimulasikan lebih realistis (kisaran 6.0 - 8.0, tengah di 7.0, amplitudo 1.0)
    const ph = parseFloat((7.0 + Math.sin(factor) * 1.0).toFixed(2));

    // TDS range 300 - 600 ppm (tengah di 450, amplitudo 150)
    const tds = Math.round(450 + Math.cos(factor) * 150);

    const status = calculateStatus(ph, tds);

    res.status(200).json({
      success: true,
      data: {
        ph,
        tds,
        timestamp: new Date().toISOString(),
        status
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
