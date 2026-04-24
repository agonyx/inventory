import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface TransferItem {
  id: string;
  transferId: string;
  variantId: string | null;
  quantity: number;
  variant: {
    id: string;
    name: string;
    sku: string;
    product: { id: string; name: string; sku: string } | null;
  } | null;
}

export interface Transfer {
  id: string;
  fromLocationId: string;
  toLocationId: string;
  status: 'draft' | 'in_transit' | 'completed' | 'cancelled';
  notes: string | null;
  createdBy: string | null;
  completedAt: string | null;
  items: TransferItem[];
  fromLocation: { id: string; name: string; type: string | null; address: string | null };
  toLocation: { id: string; name: string; type: string | null; address: string | null };
  createdAt: string;
  updatedAt: string;
}

export function useTransfers(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return useQuery({
    queryKey: ['transfers', params],
    queryFn: () => apiFetch<PaginatedResponse<Transfer>>(`/transfers${qs}`),
  });
}

export function useTransfer(id: string) {
  return useQuery({
    queryKey: ['transfers', id],
    queryFn: () => apiFetch<Transfer>(`/transfers/${id}`),
    enabled: !!id,
  });
}

export function useCreateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      fromLocationId: string;
      toLocationId: string;
      notes?: string;
      items: { variantId: string; quantity: number }[];
    }) =>
      apiFetch<Transfer>('/transfers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transfers'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useUpdateTransferStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch<Transfer>(`/transfers/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transfers'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useDeleteTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/transfers/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transfers'] });
    },
  });
}
