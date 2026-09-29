import { io } from 'socket.io-client';

let accessToken = null;

export function setAccessToken(token) {
  accessToken = token || null;
}

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const apiUrl = import.meta.env.VITE_API_URL || '';
  const response = await fetch(`${apiUrl}/api${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Backend request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export function createExamSocket(token) {
  return io(import.meta.env.VITE_SOCKET_URL || '/', {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    auth: { token },
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
  });
}

export async function fetchBackendHealth() {
  return apiRequest('/health');
}
