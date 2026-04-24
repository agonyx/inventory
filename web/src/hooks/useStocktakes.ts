import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface StocktakeItem {
  id: string;
  stocktakeId: string;
  variantId: string;
  systemQuantity: number;
  countedQuantity: number | null;
  discrepancy: number | null;
  notes: string | null;
  variant: {
    id: string;
    name: string;
    sku: string;
    product: { id: string; name: string; sku: string } | null;
  } | null;
}

export interface Stocktake {
  id: string;
  locationId: string;
  status: 'draft' | 'in_progress' | 'completed';
  notes: string | null;
  createdBy: string | null;
  completedAt: string | null;
  items: StocktakeItem[];
  location: { id: string; name: string; type: string | null; address: string | null };
  createdAt: string;
  updatedAt: string;
}

export function useStocktakes(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return useQuery({
    queryKey: ['stocktakes', params],
    queryFn: () => apiFetch<PaginatedResponse<Stocktake>>(`/stocktakes${qs}`),
  });
}

export function useStocktake(id: string) {
  return useQuery({
    queryKey: ['stocktakes', id],
    queryFn: () => apiFetch<Stocktake>(`/stocktakes/${id}`),
    enabled: !!id,
  });
}

export function useCreateStocktake() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { locationId: string; notes?: string }) =>
      apiFetch<Stocktake>('/stocktakes', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stocktakes'] });
    },
  });
}

export function useUpdateStocktakeStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch<Stocktake>(`/stocktakes/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stocktakes'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useUpdateStocktakeItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ stocktakeId, itemId, countedQuantity, notes }: { stocktakeId: string; itemId: string; countedQuantity: number; notes?: string }) =>
      apiFetch<StocktakeItem>(`/stocktakes/${stocktakeId}/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ countedQuantity, notes }),
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['stocktakes'] });
      qc.invalidateQueries({ queryKey: ['stocktakes', variables.stocktakeId] });
    },
  });
}

export function useDeleteStocktake() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/stocktakes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stocktakes'] });
    },
  });
}
