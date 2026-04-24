import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  performedBy: string | null;
  notes: string | null;
  createdAt: string;
}

export interface AuditLogPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AuditLogResponse {
  data: AuditLog[];
  pagination: AuditLogPagination;
}

export function useAuditLogs(filters: {
  page?: number;
  limit?: number;
  entityType?: string;
  entityId?: string;
  action?: string;
  performedBy?: string;
  from?: string;
  to?: string;
}) {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.entityType) params.set('entityType', filters.entityType);
  if (filters.entityId) params.set('entityId', filters.entityId);
  if (filters.action) params.set('action', filters.action);
  if (filters.performedBy) params.set('performedBy', filters.performedBy);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);

  return useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => apiFetch<AuditLogResponse>(`/audit-logs?${params.toString()}`),
  });
}
