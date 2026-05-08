import client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

export const wsConnectionsGauge = new client.Gauge({
  name: 'ws_active_connections',
  help: 'Number of active WebSocket connections',
  registers: [register],
});

export const activeRoomsGauge = new client.Gauge({
  name: 'collab_active_rooms',
  help: 'Number of active collaboration rooms',
  registers: [register],
});

export const codeExecutionsCounter = new client.Counter({
  name: 'code_executions_total',
  help: 'Total code executions',
  labelNames: ['language', 'status'],
  registers: [register],
});

export { register };
