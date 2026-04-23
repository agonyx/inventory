import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export interface PickListItem {
  orderId: string;
  externalOrderId: string;
  customerName: string;
  productName: string;
  variantName: string;
  sku: string;
  quantity: number;
  locationName: string;
  locationType: string | null;
  status: string;
}

export function usePickList() {
  return useQuery({
    queryKey: ['pick-list'],
    queryFn: () => apiFetch<PickListItem[]>('/pick-list'),
    refetchInterval: 10000, // Auto-refresh every 10s
  });
}
