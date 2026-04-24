import { useState } from 'react';
import { useAuditLogs } from '../hooks/useAuditLogs';
import { ChevronLeft, ChevronRight, Loader2, FileText } from 'lucide-react';

const ACTIONS = ['create', 'update', 'delete', 'adjust_stock', 'create_order', 'update_order_status'];
const ENTITY_TYPES = ['product', 'variant', 'inventory', 'order', 'location'];

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [filters, setFilters] = useState({
    entityType: '',
    action: '',
    performedBy: '',
  });

  const { data, isLoading } = useAuditLogs({ page, limit, ...filters });
  const logs = data?.data || [];
  const pagination = data?.pagination;

  const updateFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Audit Logs</h2>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3">
          <select
            value={filters.entityType}
            onChange={(e) => updateFilter('entityType', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="">All Entity Types</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={filters.action}
            onChange={(e) => updateFilter('action', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="">All Actions</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <input
            type="text"
            value={filters.performedBy}
            onChange={(e) => updateFilter('performedBy', e.target.value)}
            placeholder="Performed by..."
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-blue-500" size={28} />
          <span className="ml-2 text-gray-500">Loading audit logs...</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 py-16 text-center">
          <FileText className="mx-auto text-gray-300" size={48} />
          <p className="text-gray-500 mt-3">No audit logs found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Entity ID</th>
                  <th className="px-4 py-3">Performed By</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 capitalize">{log.entityType}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{log.entityId}</td>
                    <td className="px-4 py-3 text-gray-600">{log.performedBy || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{log.notes || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <span className="text-sm text-gray-500">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page >= pagination.totalPages}
                  className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
