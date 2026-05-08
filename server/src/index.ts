import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';

import { config } from './config';
import { logger } from './utils/logger';

import { setupCollaboration } from './services/collaboration.service';

import {
  register,
  httpRequestDuration,
  wsConnectionsGauge,
} from './services/metrics.service';

import {
  getPublisher,
  getSubscriber,
  closeRedis,
} from './services/redis.service';

import authRoutes from './routes/auth.routes';
import documentRoutes from './routes/document.routes';
import executionRoutes from './routes/execution.routes';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: config.cors.origin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

/**
 * WebSocket Connection Tracking
 */
io.on('connection', (socket) => {
  logger.info({ socketId: socket.id }, 'Socket connected');

  wsConnectionsGauge.inc();

  socket.on('disconnect', () => {
    logger.info({ socketId: socket.id }, 'Socket disconnected');

    wsConnectionsGauge.dec();
  });
});

/**
 * Security Middleware
 */
app.use(helmet());

/**
 * CORS
 */
app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
  })
);

/**
 * JSON Parser
 */
app.use(express.json({ limit: '1mb' }));

/**
 * HTTP Logging
 */
app.use(
  morgan('short', {
    stream: {
      write: (msg) => logger.info(msg.trim()),
    },
  })
);

/**
 * Rate Limiting
 */
app.use(
  '/api/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
  })
);

app.use(
  '/api/execute',
  rateLimit({
    windowMs: 60 * 1000,
    max: 10,
  })
);

/**
 * Request Metrics
 */
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();

  res.on('finish', () => {
    end({
      method: req.method,
      route: req.route?.path || req.path,
      status: res.statusCode,
    });
  });

  next();
});

/**
 * Routes
 */
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/execute', executionRoutes);

/**
 * Health Check
 */
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    mongodb:
      mongoose.connection.readyState === 1
        ? 'connected'
        : 'disconnected',
    redis: 'connected',
    environment: config.nodeEnv,
  });
});

/**
 * Prometheus Metrics
 */
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);

  res.end(await register.metrics());
});

/**
 * Setup Yjs Collaboration
 */
setupCollaboration(io);

/**
 * MongoDB Connection
 */
async function connectMongo(retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      await mongoose.connect(config.mongoUri);

      logger.info('Connected to MongoDB');

      return;
    } catch (err) {
      logger.warn(
        {
          attempt: i + 1,
          retries,
          err,
        },
        'MongoDB connection failed, retrying...'
      );

      if (i < retries - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, 3000)
        );
      }
    }
  }

  logger.error(
    'Could not connect to MongoDB after retries'
  );
}

/**
 * Redis Initialization
 */
async function initializeRedis() {
  try {
    getPublisher();
    getSubscriber();

    logger.info('Redis initialization started');
  } catch (err) {
    logger.error({ err }, 'Redis initialization failed');

    process.exit(1);
  }
}

/**
 * Start Server
 */
async function start() {
  try {
    /**
     * Initialize Redis
     */
    await initializeRedis();

    /**
     * Connect MongoDB
     */
    connectMongo();

    /**
     * Start HTTP Server
     */
    httpServer.listen(config.port, () => {
      logger.info(
        { port: config.port },
        'Server listening'
      );
    });
  } catch (err) {
    logger.error({ err }, 'Server startup failed');

    process.exit(1);
  }
}

/**
 * Graceful Shutdown
 */
async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutdown initiated');

  try {
    io.close();

    await mongoose.disconnect();

    await closeRedis();

    httpServer.close(() => {
      logger.info('HTTP server closed');

      process.exit(0);
    });
  } catch (err) {
    logger.error({ err }, 'Shutdown failed');

    process.exit(1);
  }
}

/**
 * Process Signals
 */
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('SIGINT', () => shutdown('SIGINT'));

/**
 * Unhandled Errors
 */
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled Promise Rejection');
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught Exception');

  process.exit(1);
});

/**
 * Bootstrap Application
 */
start();

export { app, httpServer, io };