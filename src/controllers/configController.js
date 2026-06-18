const DeviceConfig = require('../models/DeviceConfig');

// 1. GET /api/config/:device_id
// Ambil config untuk device tertentu (dipanggil ESP32 saat boot)
exports.getConfig = async (req, res) => {
  try {
    const { device_id } = req.params;
    const config = await DeviceConfig.findOne({ device_id });

    if (!config) {
      return res.status(404).json({
        success: false,
        message: `Konfigurasi tidak ditemukan untuk device: ${device_id}`
      });
    }

    res.status(200).json({
      success: true,
      data: config
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 2. POST /api/config
// Buat config baru
exports.createConfig = async (req, res) => {
  try {
    const { device_id, api_url, send_interval, is_active } = req.body;

    // Validasi input wajib
    if (!device_id || !api_url) {
      return res.status(400).json({
        success: false,
        message: 'device_id dan api_url wajib diisi'
      });
    }

    // Cek apakah device_id sudah terdaftar
    const existingConfig = await DeviceConfig.findOne({ device_id });
    if (existingConfig) {
      return res.status(400).json({
        success: false,
        message: `Konfigurasi untuk device ${device_id} sudah ada`
      });
    }

    const newConfig = new DeviceConfig({
      device_id,
      api_url,
      send_interval,
      is_active
    });

    const savedConfig = await newConfig.save();

    res.status(201).json({
      success: true,
      data: savedConfig
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// 3. PUT /api/config/:device_id
// Update config dari dashboard
exports.updateConfig = async (req, res) => {
  try {
    const { device_id } = req.params;
    const { api_url, send_interval, is_active } = req.body;

    // Cari config berdasarkan device_id
    const config = await DeviceConfig.findOne({ device_id });
    if (!config) {
      return res.status(404).json({
        success: false,
        message: `Konfigurasi tidak ditemukan untuk device: ${device_id}`
      });
    }

    // Update fields jika disediakan di request body
    if (api_url !== undefined) config.api_url = api_url;
    if (send_interval !== undefined) config.send_interval = send_interval;
    if (is_active !== undefined) config.is_active = is_active;
    config.updated_at = Date.now();

    const updatedConfig = await config.save();

    res.status(200).json({
      success: true,
      data: updatedConfig
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};
