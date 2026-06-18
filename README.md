# pH & TDS Water Monitor - REST API Documentation

Sistem backend REST API berbasis Node.js, Express.js, MongoDB Atlas, dan Socket.io untuk monitoring kualitas air secara real-time. API ini menerima data dari ESP32 Gateway (via LoRa) dan menyajikannya ke dashboard React.

---

## Konteks & Arsitektur Sistem
```
[ESP32 Transmitter] 
  └── (Sensor pH & TDS) 
        └── --[LoRa]---> [ESP32 Gateway] 
                            └── --[HTTP POST]--> [REST API (Node/Express)] ---> [MongoDB Atlas]
                                                           │ (Socket.io / Real-time)
                                                           └───> [React Dashboard]
```

## Prasyarat
- Node.js v20+
- Akun MongoDB Atlas (Cloud) atau MongoDB Lokal

## Instalasi & Cara Menjalankan

1. Masuk ke direktori backend:
   ```bash
   cd sensor-api
   ```
2. Instal dependensi:
   ```bash
   npm install
   ```
3. Konfigurasi Environment Variables:
   Buat file `.env` (berdasarkan `.env.example`) di root folder `sensor-api`:
   ```env
   PORT=3000
   MONGO_URI=mongodb://ahmddanii505_db_user:sfkZxnYidxHnZCEZ@ac-n0yhksw-shard-00-00.uv7yosk.mongodb.net:27017,ac-n0yhksw-shard-00-01.uv7yosk.mongodb.net:27017,ac-n0yhksw-shard-00-02.uv7yosk.mongodb.net:27017/sensor_db?ssl=true&replicaSet=atlas-kic26-shard-0&authSource=admin&retryWrites=true&w=majority
   ```
4. Jalankan server dalam mode Development:
   ```bash
   npm run dev
   ```

---

## Real-time WebSocket (Socket.io)
Client dashboard React dapat terhubung secara real-time ke WebSocket server di alamat:
* **URL**: `http://localhost:3000`
* **Event**: `sensor-update`
* **Payload**: Mengembalikan data sensor terbaru beserta hasil kalkulasi threshold status setiap kali ada data masuk melalui endpoint `POST /api/sensor-data`.

---

## Dokumentasi Endpoint API

Format respons JSON yang konsisten:
* Sukses: `{ "success": true, "data": ... }`
* Gagal: `{ "success": false, "message": "Pesan error" }`

### 1. Simpan Data Sensor (Dari ESP32 Gateway)
Menerima data sensor baru, menyimpannya ke database MongoDB Atlas, dan menyiarkannya (*broadcast*) via Socket.io ke dashboard secara real-time.
* **URL**: `POST /api/sensor-data`
* **Headers**: `Content-Type: application/json`
* **Request Body**:
  ```json
  {
    "ph": 7.20,
    "tds": 450,
    "device_id": "transmitter-01",
    "timestamp": "2026-06-11T12:00:00.000Z"
  }
  ```
  *(Catatan: `device_id` dan `timestamp` bersifat opsional).*
* **Validasi**:
  * `ph`: Harus di antara `0` dan `14`.
  * `tds`: Harus `>= 0`.
* **Response (201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "_id": "647f3b8398e29a3fc42d9921",
      "ph": 7.2,
      "tds": 450,
      "device_id": "transmitter-01",
      "timestamp": "2026-06-11T12:00:00.000Z",
      "createdAt": "2026-06-11T12:00:01.123Z",
      "updatedAt": "2026-06-11T12:00:01.123Z",
      "status": {
        "ph": "normal",
        "tds": "normal",
        "overall": "normal"
      }
    }
  }
  ```

---

### 2. Ambil Semua Data Historis (Dengan Filter & Pagination)
Mengambil data historis yang diurutkan dari yang terbaru (`timestamp: -1`).
* **URL**: `GET /api/sensor-data`
* **Query Parameters (Opsional)**:
  * `page`: Nomor halaman aktif (default: `1`).
  * `limit`: Jumlah data per halaman (default: `20`).
  * `from`: Filter tanggal mulai format `YYYY-MM-DD`.
  * `to`: Filter tanggal akhir format `YYYY-MM-DD`.
* **Contoh Request**: `/api/sensor-data?page=1&limit=5&from=2026-06-11&to=2026-06-12`
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "currentPage": 1,
    "totalPages": 3,
    "totalData": 15,
    "count": 5,
    "data": [
      {
        "_id": "647f3b8398e29a3fc42d9921",
        "ph": 7.2,
        "tds": 450,
        "device_id": "transmitter-01",
        "timestamp": "2026-06-11T12:00:00.000Z",
        "status": {
          "ph": "normal",
          "tds": "normal",
          "overall": "normal"
        }
      }
    ]
  }
  ```

---

### 3. Ambil Data Terbaru (Real-time Widget Polling)
* **URL**: `GET /api/sensor-data/latest`
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "_id": "647f3b8398e29a3fc42d9921",
      "ph": 7.2,
      "tds": 450,
      "device_id": "transmitter-01",
      "timestamp": "2026-06-11T12:00:00.000Z",
      "status": {
        "ph": "normal",
        "tds": "normal",
        "overall": "normal"
      }
    }
  }
  ```

---

### 4. Ambil Statistik Ringkasan (Agregasi)
Menyajikan nilai rata-rata (avg), minimal (min), dan maksimal (max) untuk pH dan TDS.
* **URL**: `GET /api/sensor-data/stats`
* **Query Parameters**:
  * `period`: `today` | `week` | `month` (default: `today`).
* **Contoh Request**: `/api/sensor-data/stats?period=week`
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "period": "week",
      "ph": {
        "avg": 7.12,
        "min": 6.2,
        "max": 8.1
      },
      "tds": {
        "avg": 420,
        "min": 310,
        "max": 580
      }
    }
  }
  ```

---

### 5. Simulasi Data Dummy (Fallback)
Menghasilkan data sensor periodik secara instan menggunakan rumus matematika tanpa menyimpannya ke database MongoDB. Sangat berguna untuk pengujian UI.
* **URL**: `GET /api/sensor-data/dummy`
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "ph": 7.12,
      "tds": 465,
      "timestamp": "2026-06-11T12:21:40.123Z",
      "status": {
        "ph": "normal",
        "tds": "normal",
        "overall": "normal"
      }
    }
  }
  ```
