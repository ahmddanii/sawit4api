const mongoose = require('mongoose');

const DeviceConfigSchema = new mongoose.Schema({
  device_id: {
    type: String,
    required: [true, 'Device ID wajib diisi'],
    unique: true
  },
  api_url: {
    type: String,
    required: [true, 'API URL wajib diisi']
  },
  send_interval: {
    type: Number,
    default: 5000 // ms
  },
  is_active: {
    type: Boolean,
    default: true
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('DeviceConfig', DeviceConfigSchema);
