import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiUpload } from '../api/client';
import type { PaginatedResponse } from '../types';

export interface Product {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  category: string | null;
  price: number;
  lowStockThreshold: number;
  supplierId: string | null;
  images: string[];
  variants: ProductVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  productId: string;
  inventoryLevels: InventoryLevel[];
  createdAt: string;
  updatedAt: string;
}

export interface InventoryLevel {
  id: string;
  variantId: string;
  locationId: string;
  quantity: number;
  reservedQuantity: number;
  location: Location;
}

export interface Location {
  id: string;
  name: string;
  type: string | null;
  address: string | null;
}

export function useProducts(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return useQuery({
    queryKey: ['products', params],
    queryFn: () => apiFetch<PaginatedResponse<Product>>(`/products${qs}`),
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Product> & { variants?: Partial<ProductVariant>[] }) =>
      apiFetch<Product>('/products', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Product> & { id: string }) =>
      apiFetch<Product>(`/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/products/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useAddVariant(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ProductVariant>) =>
      apiFetch<ProductVariant>(`/products/${productId}/variants`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useUpdateVariant(productId: string, variantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ProductVariant>) =>
      apiFetch<ProductVariant>(`/products/${productId}/variants/${variantId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useDeleteVariant(productId: string, variantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch(`/products/${productId}/variants/${variantId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useUploadProductImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, file }: { productId: string; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiUpload<{ success: boolean; image: string }>(`/products/${productId}/images`, formData);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useDeleteProductImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, index }: { productId: string; index: number }) =>
      apiFetch(`/products/${productId}/images/${index}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}
