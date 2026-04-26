import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import type { PaginatedResponse } from '../types';

export interface ReturnItem {
  id: string;
  returnId: string;
  variantId: string | null;
  quantity: number;
  condition: 'new' | 'damaged' | 'used';
  variant: {
    id: string;
    name: string;
    sku: string;
    product: { id: string; name: string; sku: string } | null;
  } | null;
}

export interface Return {
  id: string;
  orderId: string;
  reason: string;
  status: 'requested' | 'approved' | 'received' | 'refunded' | 'rejected';
  notes: string | null;
  items: ReturnItem[];
  order: {
    id: string;
    externalOrderId: string;
    customerName: string;
    customerEmail: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export function useReturns(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return useQuery({
    queryKey: ['returns', params],
    queryFn: () => apiFetch<PaginatedResponse<Return>>(`/returns${qs}`),
  });
}

export function useReturn(id: string) {
  return useQuery({
    queryKey: ['returns', id],
    queryFn: () => apiFetch<Return>(`/returns/${id}`),
    enabled: !!id,
  });
}

export function useCreateReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      orderId: string;
      reason: string;
      notes?: string;
      items: { variantId: string; quantity: number; condition?: string }[];
    }) =>
      apiFetch<Return>('/returns', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['returns'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useApproveReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<Return>(`/returns/${id}/approve`, { method: 'PATCH' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['returns'] });
    },
  });
}

export function useRejectReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<Return>(`/returns/${id}/reject`, { method: 'PATCH' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['returns'] });
    },
  });
}

export function useReceiveReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<Return>(`/returns/${id}/receive`, { method: 'PATCH' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['returns'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useRefundReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<Return>(`/returns/${id}/refund`, { method: 'PATCH' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['returns'] });
    },
  });
}

export function useDeleteReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/returns/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['returns'] });
    },
  });
}
