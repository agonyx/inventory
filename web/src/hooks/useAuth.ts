import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, logout as doLogout } from '../api/client';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export function useAuth() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => apiFetch<User>('/auth/me'),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      apiFetch<{ user: User; tokens: { accessToken: string; refreshToken: string } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    onSuccess: (data) => {
      localStorage.setItem('access_token', data.tokens.accessToken);
      localStorage.setItem('refresh_token', data.tokens.refreshToken);
      qc.setQueryData(['auth', 'me'], data.user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      doLogout();
      qc.clear();
    },
  });
}
