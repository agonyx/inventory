import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export function useBulkDeleteProducts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch<{ deleted: number }>('/bulk/products/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useBulkUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: string }) =>
      apiFetch<{ updated: number }>('/bulk/orders/bulk-status', {
        method: 'POST',
        body: JSON.stringify({ ids, status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['pick-list'] });
    },
  });
}

interface BulkAdjustment {
  inventoryLevelId: string;
  quantityChange: number;
  reason: string;
  note?: string;
}

export function useBulkAdjustInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (adjustments: BulkAdjustment[]) =>
      apiFetch<{ adjusted: number }>('/bulk/inventory/bulk-adjust', {
        method: 'POST',
        body: JSON.stringify({ adjustments }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}
