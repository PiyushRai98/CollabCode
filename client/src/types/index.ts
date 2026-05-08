export interface User {
  id: string;
  username: string;
  email: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  loadFromStorage: () => void;
}

export interface DocumentInfo {
  _id: string;
  title: string;
  language: string;
  ownerId: string;
  collaborators: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RoomUser {
  id: string;
  username: string;
  color: string;
  joinedAt: string;
}

export interface CursorData {
  userId: string;
  username: string;
  color: string;
  position: { lineNumber: number; column: number };
  selection?: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
}

export interface VersionInfo {
  _id: string;
  version: number;
  label?: string;
  createdBy: string;
  createdAt: string;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  executionTimeMs: number;
}
