import * as Y from 'yjs';
import { encoding, decoding, syncProtocol } from './yjs-utils';
import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { persistYjsState, loadYjsState, createVersionSnapshot } from './document.service';
import { verifyToken } from './auth.service';
import { RoomUser, CursorUpdate } from '../types';

interface RoomState {
  doc: Y.Doc;
  users: Map<string, RoomUser>;
  saveTimer: ReturnType<typeof setTimeout> | null;
  lastSaved: number;
}

const rooms = new Map<string, RoomState>();

const USER_COLORS = [
  '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3',
  '#00BCD4', '#009688', '#4CAF50', '#FF9800', '#FF5722',
  '#795548', '#607D8B', '#F44336', '#8BC34A', '#FFEB3B',
];

function getColor(index: number): string {
  return USER_COLORS[index % USER_COLORS.length];
}

async function getOrCreateRoom(roomId: string): Promise<RoomState> {
  let room = rooms.get(roomId);
  if (room) return room;

  const ydoc = new Y.Doc();

  // Load persisted state
  const saved = await loadYjsState(roomId);
  if (saved) {
    Y.applyUpdate(ydoc, saved);
    logger.info({ roomId }, 'Loaded persisted Yjs state');
  }

  room = {
    doc: ydoc,
    users: new Map(),
    saveTimer: null,
    lastSaved: Date.now(),
  };

  rooms.set(roomId, room);
  return room;
}

function scheduleSave(roomId: string, room: RoomState) {
  if (room.saveTimer) clearTimeout(room.saveTimer);
  room.saveTimer = setTimeout(async () => {
    try {
      const state = Y.encodeStateAsUpdate(room.doc);
      await persistYjsState(roomId, state);
      room.lastSaved = Date.now();
      logger.debug({ roomId }, 'Auto-saved document');
    } catch (err) {
      logger.error({ err, roomId }, 'Failed to auto-save');
    }
  }, 2000); // Debounce 2s
}

export function setupCollaboration(io: Server) {
  io.on('connection', async (socket: Socket) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      socket.disconnect();
      return;
    }

    let user;
    try {
      user = verifyToken(token);
    } catch {
      socket.emit('auth-error', 'Invalid token');
      socket.disconnect();
      return;
    }

    logger.info({ userId: user.id, username: user.username }, 'Socket connected');

    socket.on('join-room', async (roomId: string) => {
      try {
        const room = await getOrCreateRoom(roomId);
        socket.join(roomId);

        const roomUser: RoomUser = {
          id: user.id,
          username: user.username,
          color: getColor(room.users.size),
          joinedAt: new Date(),
        };
        room.users.set(socket.id, roomUser);

        // Send current document state to the new user
        const stateVector = Y.encodeStateVector(room.doc);
        const update = Y.encodeStateAsUpdate(room.doc);
        socket.emit('sync-init', {
          update: Buffer.from(update).toString('base64'),
          users: Array.from(room.users.values()),
          user: roomUser,
        });

        // Notify others
        socket.to(roomId).emit('user-joined', roomUser);

        logger.info({ roomId, userId: user.id }, 'User joined room');
      } catch (err) {
        logger.error({ err, roomId }, 'Failed to join room');
        socket.emit('error', 'Failed to join room');
      }
    });

    socket.on('yjs-update', (roomId: string, updateBase64: string) => {
      const room = rooms.get(roomId);
      if (!room) return;

      try {
        const update = Buffer.from(updateBase64, 'base64');
        Y.applyUpdate(room.doc, new Uint8Array(update));

        // Broadcast to all other users in the room
        socket.to(roomId).emit('yjs-update', updateBase64);

        // Schedule auto-save
        scheduleSave(roomId, room);
      } catch (err) {
        logger.error({ err, roomId }, 'Failed to apply Yjs update');
      }
    });

    socket.on('cursor-update', (roomId: string, cursor: CursorUpdate) => {
      socket.to(roomId).emit('cursor-update', cursor);
    });

    socket.on('save-version', async (roomId: string, label?: string) => {
      const room = rooms.get(roomId);
      if (!room) return;

      try {
        const state = Y.encodeStateAsUpdate(room.doc);
        const version = await createVersionSnapshot(roomId, user.id, state, label);
        io.to(roomId).emit('version-saved', {
          version: version.version,
          label: version.label,
          createdAt: version.createdAt,
        });
      } catch (err) {
        logger.error({ err, roomId }, 'Failed to save version');
      }
    });

    socket.on('disconnecting', () => {
      for (const roomId of socket.rooms) {
        if (roomId === socket.id) continue;

        const room = rooms.get(roomId);
        if (!room) continue;

        const roomUser = room.users.get(socket.id);
        room.users.delete(socket.id);

        if (roomUser) {
          socket.to(roomId).emit('user-left', roomUser);
        }

        // Cleanup empty rooms after saving
        if (room.users.size === 0) {
          const state = Y.encodeStateAsUpdate(room.doc);
          persistYjsState(roomId, state).catch((err) =>
            logger.error({ err, roomId }, 'Failed final save')
          );

          if (room.saveTimer) clearTimeout(room.saveTimer);
          room.doc.destroy();
          rooms.delete(roomId);
          logger.info({ roomId }, 'Room cleaned up');
        }
      }
    });

    socket.on('disconnect', () => {
      logger.info({ userId: user.id }, 'Socket disconnected');
    });
  });
}
