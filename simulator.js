// simulator.js
// Simulator pengiriman data dari ESP32 Gateway ke REST API (Port 3000)

const API_URL = 'http://127.0.0.1:3000/api/sensor-data';

console.log('=== Simulator ESP32 Gateway - KIDECO ===');
console.log('Mengirim data ke:', API_URL);
console.log('Tekan Ctrl+C untuk menghentikan.');

const nodes = ['KDC01', 'KDC02'];

const sendData = async () => {
  const nodeId = nodes[Math.floor(Math.random() * nodes.length)];
  
  // Pemicu kondisi bahaya acak (15% kemungkinan)
  const isDanger = Math.random() < 0.15;
  const ph = isDanger 
    ? parseFloat((3.0 + Math.random() * 1.3).toFixed(2)) // ASAM (Bahaya)
    : parseFloat((6.0 + Math.random() * 2.5).toFixed(2)); // AMAN

  const tds = isDanger
    ? Math.floor(850 + Math.random() * 500) // BAHAYA (>800 ppm)
    : Math.floor(200 + Math.random() * 550); // AMAN

  const payload = {
    ph,
    tds,
    device_id: nodeId,
    timestamp: new Date().toISOString()
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (result.success) {
      console.log(`[${new Date().toLocaleTimeString()}] SUKSES mengirim data Node: ${nodeId} | pH: ${ph} | TDS: ${tds} ppm`);
    } else {
      console.error(`[${new Date().toLocaleTimeString()}] GAGAL dari API:`, result.message);
    }
  } catch (error) {
    console.error(`[${new Date().toLocaleTimeString()}] Kesalahan Koneksi (apakah backend port 3000 aktif?):`, error.message);
  }
};

// Kirim data setiap 3 detik
setInterval(sendData, 3000);
sendData();
