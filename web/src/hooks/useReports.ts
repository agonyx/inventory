import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export interface ReportSummary {
  totalProducts: number;
  totalStockValue: number;
  lowStockCount: number;
  pendingOrders: number;
  ordersToday: number;
  totalOrders: number;
}

export interface StockByLocation {
  locationId: string;
  locationName: string;
  totalQuantity: number;
  variantCount: number;
}

export interface OrdersOverTime {
  period: string;
  count: number;
  revenue: number;
}

export interface TopProduct {
  productId: string;
  productName: string;
  sku: string;
  totalQuantity: number;
  totalRevenue: number;
}

export interface InventoryValuation {
  productId: string;
  productName: string;
  sku: string;
  totalStock: number;
  unitPrice: number;
  totalValue: number;
}

export function useReportSummary() {
  return useQuery({
    queryKey: ['reports', 'summary'],
    queryFn: () => apiFetch<ReportSummary>('/reports/summary'),
    refetchInterval: 60000,
  });
}

export function useStockByLocation() {
  return useQuery({
    queryKey: ['reports', 'stock-by-location'],
    queryFn: () => apiFetch<StockByLocation[]>('/reports/stock-by-location'),
    refetchInterval: 60000,
  });
}

export function useOrdersOverTime(from?: string, to?: string, groupBy?: string) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (groupBy) params.set('groupby', groupBy);
  return useQuery({
    queryKey: ['reports', 'orders-over-time', from, to, groupBy],
    queryFn: () => apiFetch<OrdersOverTime[]>(`/reports/orders-over-time?${params}`),
    refetchInterval: 60000,
  });
}

export function useTopProducts(limit = 10, from?: string, to?: string) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return useQuery({
    queryKey: ['reports', 'top-products', limit, from, to],
    queryFn: () => apiFetch<TopProduct[]>(`/reports/top-products?${params}`),
    refetchInterval: 60000,
  });
}

export function useInventoryValuation() {
  return useQuery({
    queryKey: ['reports', 'inventory-valuation'],
    queryFn: () => apiFetch<InventoryValuation[]>('/reports/inventory-valuation'),
    refetchInterval: 60000,
  });
}
