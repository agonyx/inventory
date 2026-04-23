import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import type { Location } from './useProducts';

export function useLocations() {
  return useQuery({
    queryKey: ['locations'],
    queryFn: () => apiFetch<Location[]>('/locations'),
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
