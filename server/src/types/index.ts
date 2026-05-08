export interface UserPayload {
  id: string;
  username: string;
  email: string;
}

export interface DocumentMeta {
  id: string;
  title: string;
  language: string;
  ownerId: string;
  collaborators: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface VersionSnapshot {
  documentId: string;
  version: number;
  content: string;
  createdBy: string;
  createdAt: Date;
  label?: string;
}

export interface ExecutionRequest {
  code: string;
  language: 'javascript' | 'python' | 'cpp';
  stdin?: string;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  executionTimeMs: number;
}

export interface CursorUpdate {
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

export interface RoomUser {
  id: string;
  username: string;
  color: string;
  joinedAt: Date;
}
