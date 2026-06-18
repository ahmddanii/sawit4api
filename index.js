const mongoose = require('mongoose');
const { server } = require('./app');

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sensor_db';

const seedDefaultConfig = async () => {
  try {
    const DeviceConfig = require('./src/models/DeviceConfig');
    const existingConfig = await DeviceConfig.findOne({ device_id: 'gateway-01' });
    if (!existingConfig) {
      await DeviceConfig.create({
        device_id: 'gateway-01',
        api_url: 'http://10.10.203.60:3000/api/sensor-data',
        send_interval: 5000,
        is_active: true
      });
      console.log('Seed data default DeviceConfig berhasil ditambahkan.');
    }
  } catch (error) {
    console.error('Gagal memasukkan seed data DeviceConfig:', error.message);
  }
};

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('Koneksi ke MongoDB berhasil terhubung.');
    seedDefaultConfig();
    server.listen(PORT, () => {
      console.log(`Server API berjalan di http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Koneksi MongoDB gagal:', error.message);
    process.exit(1);
  });
