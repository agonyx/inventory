import { useState } from 'react';
import { ArrowLeftRight, Plus, Trash2, Send, Check, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useTransfers, useUpdateTransferStatus, useDeleteTransfer } from '../hooks/useTransfers';
import TransferForm from '../components/TransferForm';
import FilterBar from '../components/FilterBar';
import type { FilterConfig } from '../components/FilterBar';
import Pagination from '../components/Pagination';
import ConfirmModal from '../components/ConfirmModal';
import SkeletonTable from '../components/SkeletonTable';
import useUrlFilters from '../hooks/useUrlFilters';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  in_transit: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const FILTER_CONFIG: FilterConfig[] = [
  { key: 'search', label: 'Search', type: 'search', placeholder: 'Search transfers...' },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'draft', label: 'Draft' },
      { value: 'in_transit', label: 'In Transit' },
      { value: 'completed', label: 'Completed' },
      { value: 'cancelled', label: 'Cancelled' },
    ],
  },
];

export default function TransfersPage() {
  const { filters, page, limit, setFilter, setPage, setLimit, resetFilters } = useUrlFilters();
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const status = filters.status || '';

  const { data, isLoading } = useTransfers({
    page: String(page),
    limit: String(limit),
    ...(status && { status }),
    ...(filters.search && { search: filters.search }),
  });

  const pagination = data?.pagination;

  const updateStatus = useUpdateTransferStatus();
  const deleteTransfer = useDeleteTransfer();

  const handleStatusChange = (id: string, newStatus: string) => {
    updateStatus.mutate(
      { id, status: newStatus },
      {
        onSuccess: () => toast.success(`Transfer ${newStatus}`),
        onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Failed to update'),
      },
    );
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteTransfer.mutate(deleteId, {
      onSuccess: () => {
        toast.success('Transfer deleted');
        setDeleteId(null);
      },
      onError: (err: any) => toast.error(err?.message || 'Failed to delete'),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ArrowLeftRight size={20} className="text-blue-600" /> Stock Transfers
        </h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={16} /> New Transfer
        </button>
      </div>

      <FilterBar
        filters={FILTER_CONFIG}
        values={filters}
        onChange={setFilter}
        onReset={resetFilters}
      />

      {isLoading ? (
        <SkeletonTable rows={5} columns={5} />
      ) : !data?.data?.length ? (
        <div className="text-center py-12 text-gray-500">
          <ArrowLeftRight size={40} className="mx-auto mb-3 opacity-30" />
          <p>No transfers found</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">From → To</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Items</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.data.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <span className="font-medium">{t.fromLocation?.name}</span>
                      <span className="mx-1.5 text-gray-400">→</span>
                      <span className="font-medium">{t.toLocation?.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.status] || ''}`}>
                        {t.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 text-blue-700 font-medium text-xs">
                        {t.items?.length || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {t.status === 'draft' && (
                          <>
                            <button
                              onClick={() => handleStatusChange(t.id, 'in_transit')}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                              title="Send"
                            >
                              <Send size={15} />
                            </button>
                            <button
                              onClick={() => setDeleteId(t.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition"
                              title="Delete"
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                        {t.status === 'in_transit' && (
                          <>
                            <button
                              onClick={() => handleStatusChange(t.id, 'completed')}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded transition"
                              title="Complete"
                            >
                              <Check size={15} />
                            </button>
                            <button
                              onClick={() => handleStatusChange(t.id, 'cancelled')}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded transition"
                              title="Cancel"
                            >
                              <XCircle size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {data.data.map((t) => (
              <div key={t.id} className="bg-white rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.status] || ''}`}>
                    {t.status.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-gray-400">{new Date(t.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="text-sm">
                  <span className="font-medium">{t.fromLocation?.name}</span>
                  <span className="mx-1 text-gray-400">→</span>
                  <span className="font-medium">{t.toLocation?.name}</span>
                </div>
                <div className="text-xs text-gray-500">{t.items?.length || 0} items</div>
                {t.status !== 'completed' && t.status !== 'cancelled' && (
                  <div className="flex gap-2 pt-1">
                    {t.status === 'draft' && (
                      <button onClick={() => handleStatusChange(t.id, 'in_transit')} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100">
                        <Send size={12} /> Send
                      </button>
                    )}
                    {t.status === 'in_transit' && (
                      <button onClick={() => handleStatusChange(t.id, 'completed')} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100">
                        <Check size={12} /> Complete
                      </button>
                    )}
                    <button onClick={() => handleStatusChange(t.id, 'cancelled')} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100">
                      <XCircle size={12} /> Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {pagination && (
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              onPageChange={setPage}
              onLimitChange={setLimit}
            />
          )}
        </>
      )}

      <TransferForm open={showForm} onClose={() => setShowForm(false)} />
      <ConfirmModal
        open={!!deleteId}
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Transfer"
        message="Are you sure you want to delete this draft transfer?"
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
