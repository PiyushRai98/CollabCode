import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

let publisher: Redis | null = null;
let subscriber: Redis | null = null;

export function getPublisher(): Redis {
  if (!publisher) {
    publisher = new Redis(config.redisUrl, { maxRetriesPerRequest: 3 });
    publisher.on('error', (err) => logger.error({ err }, 'Redis publisher error'));
    publisher.on('connect', () => logger.info('Redis publisher connected'));
  }
  return publisher;
}

export function getSubscriber(): Redis {
  if (!subscriber) {
    subscriber = new Redis(config.redisUrl, { maxRetriesPerRequest: 3 });
    subscriber.on('error', (err) => logger.error({ err }, 'Redis subscriber error'));
    subscriber.on('connect', () => logger.info('Redis subscriber connected'));
  }
  return subscriber;
}

export async function publishUpdate(channel: string, data: Buffer | string) {
  const pub = getPublisher();
  await pub.publish(channel, typeof data === 'string' ? data : data.toString('base64'));
}

export async function subscribeToRoom(roomId: string, handler: (data: string) => void) {
  const sub = getSubscriber();
  const channel = `room:${roomId}`;
  await sub.subscribe(channel);
  sub.on('message', (ch, message) => {
    if (ch === channel) handler(message);
  });
}

export async function unsubscribeFromRoom(roomId: string) {
  const sub = getSubscriber();
  await sub.unsubscribe(`room:${roomId}`);
}

export async function closeRedis() {
  if (publisher) await publisher.quit();
  if (subscriber) await subscriber.quit();
  publisher = null;
  subscriber = null;
}
