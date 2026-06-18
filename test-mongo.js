const mongoose = require('mongoose');

const uri = 'mongodb://127.0.0.1:27017/sensor_db';
console.log('Menghubungkan ke MongoDB di:', uri);

mongoose.connect(uri)
  .then(() => {
    console.log('Koneksi sukses!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Koneksi gagal:', err);
    process.exit(1);
  });
