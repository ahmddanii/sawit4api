const mongoose = require('mongoose');

// Skema untuk menyimpan data sensor pH dan TDS
const SensorReadingSchema = new mongoose.Schema({
  ph: {
    type: Number,
    required: [true, 'Nilai pH wajib diisi'],
    min: [0, 'Nilai pH minimal adalah 0'],
    max: [14, 'Nilai pH maksimal adalah 14']
  },
  tds: {
    type: Number,
    required: [true, 'Nilai TDS wajib diisi'],
    min: [0, 'Nilai TDS harus lebih besar atau sama dengan 0']
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  device_id: {
    type: String,
    default: 'transmitter-01'
  }
}, {
  timestamps: true // Menambahkan createdAt dan updatedAt secara otomatis
});

module.exports = mongoose.model('SensorReading', SensorReadingSchema);
