import { create } from 'zustand';
import { authApi } from '../services/api';
import type { AuthState, RoomUser } from '../types';

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  login: async (email, password) => {
    const { user, token } = await authApi.login(email, password);
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },

  register: async (username, email, password) => {
    const { user, token } = await authApi.register(username, email, password);
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadFromStorage: () => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ user, token, isAuthenticated: true });
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  },
}));

interface EditorState {
  roomId: string | null;
  language: string;
  theme: 'vs-dark' | 'light';
  users: RoomUser[];
  myUser: RoomUser | null;
  setRoomId: (id: string | null) => void;
  setLanguage: (lang: string) => void;
  toggleTheme: () => void;
  setUsers: (users: RoomUser[]) => void;
  addUser: (user: RoomUser) => void;
  removeUser: (userId: string) => void;
  setMyUser: (user: RoomUser) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  roomId: null,
  language: 'javascript',
  theme: 'vs-dark',
  users: [],
  myUser: null,

  setRoomId: (id) => set({ roomId: id }),
  setLanguage: (lang) => set({ language: lang }),
  toggleTheme: () =>
    set((s) => ({ theme: s.theme === 'vs-dark' ? 'light' : 'vs-dark' })),
  setUsers: (users) => set({ users }),
  addUser: (user) => set((s) => ({ users: [...s.users, user] })),
  removeUser: (userId) =>
    set((s) => ({ users: s.users.filter((u) => u.id !== userId) })),
  setMyUser: (user) => set({ myUser: user }),
}));
