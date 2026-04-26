import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import type { PaginatedResponse } from '../types';

export interface Location {
  id: string;
  name: string;
  type: string | null;
  address: string | null;
  variantCount?: number;
  createdAt?: string;
}

export function useLocations(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return useQuery({
    queryKey: ['locations', params],
    queryFn: () => apiFetch<PaginatedResponse<Location>>(`/locations${qs}`),
  });
}

export function useLocation(id: string) {
  return useQuery({
    queryKey: ['locations', id],
    queryFn: () => apiFetch<Location>(`/locations/${id}`),
    enabled: !!id,
  });
}

export function useCreateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Location>) =>
      apiFetch<Location>('/locations', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['locations'] }),
  });
}

export function useUpdateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Location>) =>
      apiFetch<Location>(`/locations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['locations'] }),
  });
}

export function useDeleteLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/locations/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['locations'] }),
  });
}
