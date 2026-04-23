import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

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
