import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export interface Order {
  id: string;
  externalOrderId: string;
  status: 'pending' | 'confirmed' | 'packed' | 'shipped' | 'cancelled';
  customerName: string;
  customerEmail: string;
  shippingAddress: string | null;
  totalAmount: number;
  source: string | null;
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

export function useOrders(status?: string) {
  return useQuery({
    queryKey: ['orders', status],
    queryFn: () => apiFetch<Order[]>(`/orders${status ? `?status=${status}` : ''}`),
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
