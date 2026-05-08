import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/collab-editor',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-prod',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },
  nodeEnv: process.env.NODE_ENV || 'development',
  docker: {
    socket: process.env.DOCKER_SOCKET || '/var/run/docker.sock',
    timeoutMs: parseInt(process.env.EXECUTION_TIMEOUT_MS || '10000', 10),
    memoryMb: parseInt(process.env.EXECUTION_MEMORY_MB || '128', 10),
  },
} as const;
