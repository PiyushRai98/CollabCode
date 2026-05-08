import { useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { Socket } from 'socket.io-client';
import { connectSocket, disconnectSocket } from '../services/socket';
import { useAuthStore } from '../lib/store';
import { useEditorStore } from '../lib/store';
import type { CursorData, RoomUser } from '../types';

export function useCollaboration(roomId: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const token = useAuthStore((s) => s.token);
  const { setUsers, addUser, removeUser, setMyUser } = useEditorStore();

  useEffect(() => {
    if (!roomId || !token) return;

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const socket = connectSocket(token);
    socketRef.current = socket;

    socket.emit('join-room', roomId);

    socket.on('sync-init', (data: { update: string; users: RoomUser[]; user: RoomUser }) => {
      const update = Uint8Array.from(atob(data.update), (c) => c.charCodeAt(0));
      Y.applyUpdate(ydoc, update);
      setUsers(data.users);
      setMyUser(data.user);
    });

    socket.on('yjs-update', (updateBase64: string) => {
      const update = Uint8Array.from(atob(updateBase64), (c) => c.charCodeAt(0));
      Y.applyUpdate(ydoc, update);
    });

    socket.on('user-joined', (user: RoomUser) => addUser(user));
    socket.on('user-left', (user: RoomUser) => removeUser(user.id));

    // Listen for local changes and broadcast
    const updateHandler = (update: Uint8Array, origin: any) => {
      if (origin === 'remote') return;
      const base64 = btoa(String.fromCharCode(...update));
      socket.emit('yjs-update', roomId, base64);
    };
    ydoc.on('update', updateHandler);

    return () => {
      ydoc.off('update', updateHandler);
      ydoc.destroy();
      ydocRef.current = null;
      disconnectSocket();
      socketRef.current = null;
    };
  }, [roomId, token]);

  const sendCursor = useCallback(
    (cursor: Omit<CursorData, 'userId' | 'username' | 'color'>) => {
      if (!socketRef.current || !roomId) return;
      const myUser = useEditorStore.getState().myUser;
      if (!myUser) return;
      socketRef.current.emit('cursor-update', roomId, {
        ...cursor,
        userId: myUser.id,
        username: myUser.username,
        color: myUser.color,
      });
    },
    [roomId]
  );

  const saveVersion = useCallback(
    (label?: string) => {
      if (!socketRef.current || !roomId) return;
      socketRef.current.emit('save-version', roomId, label);
    },
    [roomId]
  );

  return {
    ydoc: ydocRef,
    socket: socketRef,
    sendCursor,
    saveVersion,
  };
}
