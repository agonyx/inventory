import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  secret: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const WEBHOOK_EVENT_TYPES = [
  'order.created',
  'order.status_changed',
  'stock.low',
  'stock.adjusted',
] as const;

export function useWebhookConfigs() {
  return useQuery({
    queryKey: ['webhook-configs'],
    queryFn: () => apiFetch<WebhookConfig[]>('/webhooks/config'),
  });
}

export function useCreateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { url: string; events: string[]; secret?: string; isActive?: boolean }) =>
      apiFetch<WebhookConfig>('/webhooks/config', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhook-configs'] }),
  });
}

export function useUpdateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; url?: string; events?: string[]; secret?: string; isActive?: boolean }) =>
      apiFetch<WebhookConfig>(`/webhooks/config/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhook-configs'] }),
  });
}

export function useDeleteWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: boolean }>(`/webhooks/config/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhook-configs'] }),
  });
}
