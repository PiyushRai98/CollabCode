const API_BASE = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || 'Request failed');
  }

  return res.json();
}

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    request<{ user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (username: string, email: string, password: string) =>
    request<{ user: any; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    }),
};

// Documents
export const documentApi = {
  create: (title: string, language: string) =>
    request<any>('/documents', {
      method: 'POST',
      body: JSON.stringify({ title, language }),
    }),

  getMine: () => request<any[]>('/documents/mine'),

  getById: (id: string) => request<any>(`/documents/${id}`),

  update: (id: string, updates: { title?: string; language?: string }) =>
    request<any>(`/documents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  getVersions: (id: string) => request<any[]>(`/documents/${id}/versions`),

  createVersion: (id: string, label?: string) =>
    request<any>(`/documents/${id}/versions`, {
      method: 'POST',
      body: JSON.stringify({ label }),
    }),

  restoreVersion: (id: string, version: number) =>
    request<any>(`/documents/${id}/restore/${version}`, { method: 'POST' }),
};

// Execution
export const executionApi = {
  run: (code: string, language: string, stdin?: string) =>
    request<any>('/execute', {
      method: 'POST',
      body: JSON.stringify({ code, language, stdin }),
    }),
};
