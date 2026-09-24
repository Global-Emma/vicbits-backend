require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const cookieParser = require('cookie-parser');
const Redis = require('ioredis');

// Database Connection
const connectDB = require('./src/config/db');

// Route Imports
const authRoutes = require('./src/routes/authRoute');
const serviceRoutes = require('./src/routes/serviceRoute');
const projectRoutes = require('./src/routes/projectRoute');
const applicationRoutes = require('./src/routes/applicationRoute');
const messageRoutes = require('./src/routes/messageRoute');
const notificationRoutes = require('./src/routes/notificationRoute');

// Sockets
const initSocket = require('./src/sockets/chatSocket');

const app = express();

// ==========================================
// 1. DATABASE & REDIS SETUP
// ==========================================

// Connect to MongoDB
connectDB();

// Initialize Redis Client with graceful fallback for local/dev environments.
// A broken or unreachable Redis connection should not block the API from starting.
let redisClient = null;

if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });

  redisClient.on('connect', () => {
    console.log('✅ Connected to Redis Cache');
  });

  redisClient.on('error', (error) => {
    console.warn('⚠️ Redis unavailable; continuing without cache:', error.message);

    if (/NOAUTH|Authentication failed|ENOTFOUND|ETIMEDOUT|ECONNRESET|ECONNREFUSED/i.test(error.message)) {
      if (redisClient) {
        redisClient.disconnect();
      }
      redisClient = null;
    }
  });

  redisClient.connect().catch((error) => {
    console.warn('⚠️ Redis cache disabled because the configured connection is unavailable:', error.message);
    if (redisClient) {
      redisClient.disconnect();
    }
    redisClient = null;
  });
} else {
  console.log('ℹ️ REDIS_URL not configured. Running without Redis cache.');
}

// ==========================================
// 2. MIDDLEWARES & SECURITY
// ==========================================

// Dynamic CORS Origin Configuration
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:3000',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or Postman)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Set to callback(new Error('Not allowed by CORS')) if strict domain locking is required
      }
    },
    credentials: true,
  })
);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global Middleware to attach Redis Client to all incoming requests
app.use((req, res, next) => {
  req.redisClient = redisClient;
  next();
});

// ==========================================
// 3. API ROUTES
// ==========================================

app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/apply', applicationRoutes);
app.use('/api/chat', messageRoutes);
app.use('/api/notifications', notificationRoutes);

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// ==========================================
// 4. GLOBAL ERROR HANDLER
// ==========================================

app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.stack);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { error: err.stack }),
  });
});

// ==========================================
// 5. SERVER & SOCKET INITIALIZATION
// ==========================================

const server = http.createServer(app);

// Initialize Socket.io
initSocket(server, redisClient);

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// ==========================================
// 6. GRACEFUL SHUTDOWN HANDLER
// ==========================================

const gracefulShutdown = (signal) => {
  console.log(`\n⚠️  ${signal} received. Closing HTTP server and connections...`);

  server.close(async () => {
    console.log('HTTP server closed.');

    try {
      await redisClient.quit();
      console.log('Redis client disconnected.');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));