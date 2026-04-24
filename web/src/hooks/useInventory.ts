import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export interface InventoryLevel {
  id: string;
  variantId: string;
  locationId: string;
  quantity: number;
  reservedQuantity: number;
  variant: { id: string; name: string; sku: string; product: { id: string; name: string } };
  location: { id: string; name: string; type: string | null };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export function useInventory(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return useQuery({
    queryKey: ['inventory', params],
    queryFn: () => apiFetch<PaginatedResponse<InventoryLevel>>(`/inventory${qs}`),
  });
}

export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      quantityChange: number;
      reason: string;
      notes?: string;
      adjustedBy?: string;
    }) =>
      apiFetch(`/inventory/${id}/adjust`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}
