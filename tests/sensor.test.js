const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../app');
const SensorReading = require('../src/models/SensorReading');

const TEST_MONGO_URI = 'mongodb://127.0.0.1:27017/sensor_db_test';

beforeAll(async () => {
  // Set environment variable to test to suppress logs
  process.env.NODE_ENV = 'test';
  
  // Connect to the test database
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(TEST_MONGO_URI);
  }
});

afterEach(async () => {
  // Clean up the collection between tests to ensure test isolation
  await SensorReading.deleteMany({});
});

afterAll(async () => {
  // Disconnect mongoose connection cleanly
  await mongoose.disconnect();
});

describe('Sensor REST API Test Suite', () => {

  // 1. GET / - Root Endpoint
  describe('GET /', () => {
    it('should return API status message', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Sensor Monitoring REST API is active and running.'
      });
    });
  });

  // 2. POST /api/sensor-data - Create reading
  describe('POST /api/sensor-data', () => {
    it('should successfully save a new sensor reading and return calculated status', async () => {
      const payload = {
        ph: 7.2,
        tds: 350,
        device_id: 'transmitter-01'
      };

      const response = await request(app)
        .post('/api/sensor-data')
        .send(payload)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.ph).toBe(7.2);
      expect(response.body.data.tds).toBe(350);
      expect(response.body.data.device_id).toBe('transmitter-01');
      
      // status calculation (pH 7.2 is normal, TDS 350 is normal -> overall normal)
      expect(response.body.data.status.ph).toBe('normal');
      expect(response.body.data.status.tds).toBe('normal');
      expect(response.body.data.status.overall).toBe('normal');
    });

    it('should flag status as warning if pH violates thresholds (e.g. acidic)', async () => {
      const payload = {
        ph: 3.2, // normal range: 6.5 - 8.5
        tds: 350,
        device_id: 'transmitter-01'
      };

      const response = await request(app)
        .post('/api/sensor-data')
        .send(payload)
        .expect(201);

      expect(response.body.data.status.ph).toBe('warning');
      expect(response.body.data.status.overall).toBe('warning');
    });

    it('should return 400 Bad Request if pH or TDS is missing', async () => {
      const payload = {
        ph: 7.2
      };

      const response = await request(app)
        .post('/api/sensor-data')
        .send(payload)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('ph dan tds wajib disertakan');
    });
  });

  // 3. GET /api/sensor-data - Retrieve all readings
  describe('GET /api/sensor-data', () => {
    it('should return empty list when no data present', async () => {
      const response = await request(app)
        .get('/api/sensor-data')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(0);
      expect(response.body.totalData).toBe(0);
    });

    it('should return saved readings with correct count and status', async () => {
      await SensorReading.create([
        { ph: 7.0, tds: 400, timestamp: new Date() },
        { ph: 6.0, tds: 600, timestamp: new Date(Date.now() - 5000) }
      ]);

      const response = await request(app)
        .get('/api/sensor-data')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2);
      expect(response.body.totalData).toBe(2);
      expect(response.body.data[0].ph).toBe(7.0);
      expect(response.body.data[1].ph).toBe(6.0);
      expect(response.body.data[1].status.ph).toBe('warning'); // ph 6.0 is warning
    });

    it('should apply limit and pagination correctly', async () => {
      const readings = Array.from({ length: 5 }, (_, i) => ({
        ph: 7.0,
        tds: 400 + i,
        timestamp: new Date(Date.now() - i * 1000)
      }));
      await SensorReading.create(readings);

      const response = await request(app)
        .get('/api/sensor-data?limit=2&page=2')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2);
      expect(response.body.totalData).toBe(5);
      expect(response.body.totalPages).toBe(3);
    });
  });

  // 4. GET /api/sensor-data/latest - Retrieve latest reading
  describe('GET /api/sensor-data/latest', () => {
    it('should return 404 if no readings are available', async () => {
      const response = await request(app)
        .get('/api/sensor-data/latest')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Belum ada data sensor');
    });

    it('should return the single latest reading sorted by timestamp', async () => {
      const oldest = new Date(Date.now() - 10000);
      const newest = new Date();
      await SensorReading.create([
        { ph: 7.5, tds: 300, timestamp: oldest },
        { ph: 6.8, tds: 420, timestamp: newest }
      ]);

      const response = await request(app)
        .get('/api/sensor-data/latest')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.ph).toBe(6.8);
      expect(response.body.data.tds).toBe(420);
    });
  });

  // 5. GET /api/sensor-data/stats - Retrieve stats
  describe('GET /api/sensor-data/stats', () => {
    it('should return empty stats structure when no readings are in range', async () => {
      const response = await request(app)
        .get('/api/sensor-data/stats?period=today')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.ph).toEqual({ avg: 0, min: 0, max: 0 });
      expect(response.body.data.tds).toEqual({ avg: 0, min: 0, max: 0 });
    });

    it('should calculate stats min, max, avg correctly', async () => {
      await SensorReading.create([
        { ph: 6.0, tds: 300, timestamp: new Date() },
        { ph: 8.0, tds: 500, timestamp: new Date() }
      ]);

      const response = await request(app)
        .get('/api/sensor-data/stats?period=today')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.ph.min).toBe(6.0);
      expect(response.body.data.ph.max).toBe(8.0);
      expect(response.body.data.ph.avg).toBe(7.0);
      expect(response.body.data.tds.min).toBe(300);
      expect(response.body.data.tds.max).toBe(500);
      expect(response.body.data.tds.avg).toBe(400);
    });
  });

  // 6. GET /api/sensor-data/dummy - Dummy simulator endpoint
  describe('GET /api/sensor-data/dummy', () => {
    it('should return a valid dummy reading without saving to database', async () => {
      const response = await request(app)
        .get('/api/sensor-data/dummy')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.ph).toBeGreaterThanOrEqual(2.0);
      expect(response.body.data.ph).toBeLessThanOrEqual(10.0);
      expect(response.body.data.tds).toBeGreaterThanOrEqual(100);
      expect(response.body.data.tds).toBeLessThanOrEqual(1600);
      expect(response.body.data.timestamp).toBeDefined();

      // Ensure it was not saved to database
      const count = await SensorReading.countDocuments();
      expect(count).toBe(0);
    });
  });
});
