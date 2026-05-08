/**
 * Load test simulation for the collaboration server.
 * Run: npx tsx src/utils/load-test.ts
 *
 * Simulates N concurrent WebSocket connections editing the same document.
 */
import { io as ioClient, Socket } from 'socket.io-client';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
const NUM_CLIENTS = parseInt(process.env.NUM_CLIENTS || '50', 10);
const ROOM_ID = process.env.ROOM_ID || 'load-test-room';
const DURATION_MS = parseInt(process.env.DURATION_MS || '30000', 10);
const EDIT_INTERVAL_MS = 200;

interface Stats {
  connected: number;
  messagesSent: number;
  messagesReceived: number;
  errors: number;
  latencies: number[];
}

const stats: Stats = {
  connected: 0,
  messagesSent: 0,
  messagesReceived: 0,
  errors: 0,
  latencies: [],
};

async function createClient(index: number, token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(SERVER_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error(`Client ${index} connection timeout`));
    }, 10000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      stats.connected++;
      socket.emit('join-room', ROOM_ID);
      resolve(socket);
    });

    socket.on('yjs-update', () => {
      stats.messagesReceived++;
    });

    socket.on('connect_error', (err) => {
      stats.errors++;
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function simulateEdits(socket: Socket, index: number): NodeJS.Timeout {
  return setInterval(() => {
    // Simulate a simple Yjs update (base64 encoded)
    const fakeUpdate = Buffer.from(`edit-${index}-${Date.now()}`).toString('base64');
    const sendTime = Date.now();
    socket.emit('yjs-update', ROOM_ID, fakeUpdate);
    stats.messagesSent++;
  }, EDIT_INTERVAL_MS);
}

async function run() {
  console.log(`\n--- Load Test ---`);
  console.log(`Server: ${SERVER_URL}`);
  console.log(`Clients: ${NUM_CLIENTS}`);
  console.log(`Duration: ${DURATION_MS / 1000}s`);
  console.log(`Room: ${ROOM_ID}\n`);

  // In a real test, you'd authenticate each client.
  // For this simulation, we use a dummy token.
  const token = 'load-test-token';

  const sockets: Socket[] = [];
  const timers: NodeJS.Timeout[] = [];

  console.log('Connecting clients...');
  const connectStart = Date.now();

  for (let i = 0; i < NUM_CLIENTS; i++) {
    try {
      const socket = await createClient(i, token);
      sockets.push(socket);
      timers.push(simulateEdits(socket, i));
    } catch (err: any) {
      console.error(`Client ${i} failed: ${err.message}`);
    }
  }

  const connectTime = Date.now() - connectStart;
  console.log(`Connected ${stats.connected}/${NUM_CLIENTS} clients in ${connectTime}ms\n`);
  console.log('Running load test...');

  await new Promise((resolve) => setTimeout(resolve, DURATION_MS));

  // Cleanup
  timers.forEach(clearInterval);
  sockets.forEach((s) => s.disconnect());

  // Report
  console.log('\n--- Results ---');
  console.log(`Connected: ${stats.connected}/${NUM_CLIENTS}`);
  console.log(`Messages sent: ${stats.messagesSent}`);
  console.log(`Messages received: ${stats.messagesReceived}`);
  console.log(`Errors: ${stats.errors}`);
  console.log(`Throughput: ${(stats.messagesSent / (DURATION_MS / 1000)).toFixed(0)} msg/s sent`);
  console.log(`           ${(stats.messagesReceived / (DURATION_MS / 1000)).toFixed(0)} msg/s received`);

  if (stats.latencies.length > 0) {
    const sorted = stats.latencies.sort((a, b) => a - b);
    console.log(`Latency p50: ${sorted[Math.floor(sorted.length * 0.5)]}ms`);
    console.log(`Latency p99: ${sorted[Math.floor(sorted.length * 0.99)]}ms`);
  }

  process.exit(0);
}

run().catch(console.error);
