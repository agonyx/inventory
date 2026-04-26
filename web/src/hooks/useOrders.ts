import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import type { PaginatedResponse } from '../types';

export interface Order {
  id: string;
  externalOrderId: string;
  status: 'pending' | 'confirmed' | 'packed' | 'shipped' | 'cancelled';
  customerName: string;
  customerEmail: string;
  shippingAddress: string | null;
  totalAmount: number;
  source: string | null;
  trackingNumber: string | null;
  shippingCarrier: string | null;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  variantId: string | null;
  externalSku: string | null;
  quantity: number;
  unitPrice: number;
  variant: {
    id: string;
    name: string;
    sku: string;
    product: { id: string; name: string; sku: string } | null;
  } | null;
}

export function useOrders(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return useQuery({
    queryKey: ['orders', params],
    queryFn: () => apiFetch<PaginatedResponse<Order>>(`/orders${qs}`),
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch<Order>(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['pick-list'] });
    },
  });
}

export function useUpdateShipping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, trackingNumber, shippingCarrier }: { id: string; trackingNumber: string; shippingCarrier: string }) =>
      apiFetch<Order>(`/orders/${id}/shipping`, { method: 'PATCH', body: JSON.stringify({ trackingNumber, shippingCarrier }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export interface TrackingUrlResponse {
  trackingUrl: string;
  trackingNumber: string;
  shippingCarrier: string;
}

export function useOrderTrackingUrl(id: string | undefined) {
  return useQuery({
    queryKey: ['orders', id, 'tracking-url'],
    queryFn: () => apiFetch<TrackingUrlResponse>(`/orders/${id}/tracking-url`),
    enabled: !!id,
    retry: false,
  });
}
