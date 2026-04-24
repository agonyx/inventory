import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10000,
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnMount: 'always',
      refetchOnReconnect: true,
    },
  },
});

const API_BASE = '/api';

function getAccessToken(): string | null {
  return localStorage.getItem('access_token');
}

function getRefreshToken(): string | null {
  return localStorage.getItem('refresh_token');
}

function setTokens(access: string, refresh: string) {
  localStorage.setItem('access_token', access);
  localStorage.setItem('refresh_token', refresh);
}

function clearTokens() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  const refresh = getRefreshToken();
  if (!refresh) throw new Error('No refresh token');

  refreshPromise = fetch('/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh }),
  })
    .then(async (res) => {
      if (!res.ok) throw new Error('Refresh failed');
      const data = await res.json();
      setTokens(data.tokens.accessToken, data.tokens.refreshToken);
      return data.tokens.accessToken;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const makeRequest = async (token: string | null): Promise<Response> => {
    return fetch(`${API_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...options,
    });
  };

  let token = getAccessToken();
  let res = await makeRequest(token);

  // If 401, try refreshing token once
  if (res.status === 401 && getRefreshToken()) {
    try {
      token = await refreshAccessToken();
      res = await makeRequest(token);
    } catch {
      clearTokens();
      window.location.href = '/login';
      throw new Error('Session expired. Please log in again.');
    }
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Request failed: ${res.status}`);
  }

  return res.json();
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Upload failed: ${res.status}`);
  }

  return res.json();
}

export function logout() {
  clearTokens();
  window.location.href = '/login';
}

/**
 * Open a binary URL (PDF, CSV, etc.) with the auth token attached.
 * Appends token as a query param since we can't set headers on window.open.
 */
export function openAuthenticatedUrl(path: string, options?: { download?: boolean }) {
  const token = getAccessToken();
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (options?.download) url.searchParams.set('download', 'true');
  if (token) url.searchParams.set('token', token);
  window.open(url.toString(), '_blank');
}
