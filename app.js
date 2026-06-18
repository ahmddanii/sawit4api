const express = require('express');
const cors = require('cors');
require('dotenv').config();

const sensorRoutes = require('./src/routes/sensor');
const configRoutes = require('./src/routes/config');
const aiRoutes = require('./src/routes/ai');

const app = express();

// Middleware
app.use(cors()); // Mengizinkan CORS agar bisa diakses dari port React frontend yang berbeda
app.use(express.json()); // Parsing request body berupa JSON

// Logger Middleware Sederhana (hanya dijalankan saat bukan dalam env testing)
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// Routes
app.use('/api/sensor-data', sensorRoutes);
app.use('/api', configRoutes);
app.use('/api/ai', aiRoutes);

// Root Endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Sensor Monitoring REST API is active and running.'
  });
});

// Handling 404 (Not Found)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint tidak ditemukan'
  });
});

// Handling Server creation, Socket.io
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Jadikan instance io dapat diakses di controller
app.set('socketio', io);

io.on('connection', (socket) => {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`Client terhubung ke socket: ${socket.id}`);
  }
  
  socket.on('disconnect', () => {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`Client terputus dari socket: ${socket.id}`);
    }
  });
});

module.exports = { app, server, io };
