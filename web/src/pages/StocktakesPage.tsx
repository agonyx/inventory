import { useState } from 'react';
import { ClipboardCheck, Plus, Play, CheckCircle2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useStocktakes, useStocktake, useCreateStocktake, useUpdateStocktakeStatus, useUpdateStocktakeItem, useDeleteStocktake } from '../hooks/useStocktakes';
import { useLocations } from '../hooks/useLocations';
import FilterBar from '../components/FilterBar';
import type { FilterConfig } from '../components/FilterBar';
import Pagination from '../components/Pagination';
import ConfirmModal from '../components/ConfirmModal';
import SkeletonTable from '../components/SkeletonTable';
import useUrlFilters from '../hooks/useUrlFilters';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
};

const FILTER_CONFIG: FilterConfig[] = [
  { key: 'search', label: 'Search', type: 'search', placeholder: 'Search stocktakes...' },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'draft', label: 'Draft' },
      { value: 'in_progress', label: 'In Progress' },
      { value: 'completed', label: 'Completed' },
    ],
  },
];

interface CreateStocktakeModalProps {
  open: boolean;
  onClose: () => void;
}

function CreateStocktakeModal({ open, onClose }: CreateStocktakeModalProps) {
  const [locationId, setLocationId] = useState('');
  const [notes, setNotes] = useState('');
  const { data: locationsData } = useLocations({ limit: '100' });
  const locations = locationsData?.data ?? [];
  const create = useCreateStocktake();

  const handleSubmit = () => {
    if (!locationId) { toast.error('Please select a location'); return; }
    create.mutate(
      { locationId, notes: notes || undefined },
      {
        onSuccess: () => { toast.success('Stocktake created'); onClose(); setLocationId(''); setNotes(''); },
        onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Failed to create'),
      },
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">New Stocktake</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><Trash2 size={16} className="text-gray-400 rotate-45" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select location...</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional notes..." />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
          <button onClick={handleSubmit} disabled={create.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {create.isPending ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface StocktakeCountModalProps {
  stocktakeId: string;
  open: boolean;
  onClose: () => void;
}

function StocktakeCountModal({ stocktakeId, open, onClose }: StocktakeCountModalProps) {
  const { data: stocktake, isLoading } = useStocktake(stocktakeId);
  const updateItem = useUpdateStocktakeItem();

  const items = stocktake?.items ?? [];
  const discrepancies = items.filter((i: any) => i.discrepancy !== null && i.discrepancy !== 0).length;
  const unchanged = items.filter((i: any) => i.countedQuantity !== null).length;

  const handleCount = (itemId: string, countedQty: number) => {
    updateItem.mutate(
      { stocktakeId, itemId, countedQuantity: countedQty },
      { onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Failed to update') },
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto mx-4">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white rounded-t-xl">
          <div>
            <h2 className="text-lg font-semibold">Count Items — {stocktake?.location?.name}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {unchanged}/{items.length} counted · {discrepancies} discrepancies
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><Trash2 size={16} className="text-gray-400 rotate-45" /></button>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <div className="divide-y">
            {items.map((item: any) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {item.variant?.product?.name} — {item.variant?.name}
                  </div>
                  <div className="text-xs text-gray-500">SKU: {item.variant?.sku} · System: {item.systemQuantity}</div>
                </div>
                <div className="flex items-center gap-2 w-32">
                  <input
                    type="number"
                    min={0}
                    value={item.countedQuantity ?? ''}
                    placeholder={String(item.systemQuantity)}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val >= 0) handleCount(item.id, val);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = parseInt((e.target as HTMLInputElement).value);
                        if (!isNaN(val) && val >= 0) handleCount(item.id, val);
                      }
                    }}
                    className={`w-full px-2 py-1.5 text-sm border rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      item.discrepancy === null ? 'border-gray-200' :
                      item.discrepancy === 0 ? 'border-green-200 bg-green-50' :
                      'border-red-200 bg-red-50'
                    }`}
                  />
                </div>
                {item.discrepancy !== null && (
                  <span className={`text-xs font-medium w-14 text-right ${
                    item.discrepancy > 0 ? 'text-green-600' : item.discrepancy < 0 ? 'text-red-600' : 'text-gray-400'
                  }`}>
                    {item.discrepancy > 0 ? '+' : ''}{item.discrepancy}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function StocktakesPage() {
  const { filters, page, limit, setFilter, setPage, setLimit, resetFilters } = useUrlFilters();
  const [showCreate, setShowCreate] = useState(false);
  const [countStocktakeId, setCountStocktakeId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const status = filters.status || '';

  const { data, isLoading } = useStocktakes({
    page: String(page),
    limit: String(limit),
    ...(status && { status }),
  });

  const pagination = data?.pagination;

  const updateStatus = useUpdateStocktakeStatus();
  const deleteStocktake = useDeleteStocktake();

  const handleStatus = (id: string, newStatus: string) => {
    updateStatus.mutate(
      { id, status: newStatus },
      {
        onSuccess: () => toast.success(`Stocktake ${newStatus.replace('_', ' ')}`),
        onError: (err: any) => toast.error(err?.message || 'Failed'),
      },
    );
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteStocktake.mutate(deleteId, {
      onSuccess: () => { toast.success('Deleted'); setDeleteId(null); },
      onError: (err: any) => toast.error(err?.message || 'Failed'),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardCheck size={20} className="text-blue-600" /> Stocktakes
        </h2>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition">
          <Plus size={16} /> New Stocktake
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
          <ClipboardCheck size={40} className="mx-auto mb-3 opacity-30" />
          <p>No stocktakes found</p>
        </div>
      ) : (
        <>
          <div className="hidden md:block bg-white rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Location</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Items</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Discrepancies</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.data.map((s) => {
                  const discrepancies = s.items?.filter((i: any) => i.discrepancy !== null && i.discrepancy !== 0).length || 0;
                  return (
                    <tr key={s.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-medium">{s.location?.name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s.status] || ''}`}>
                          {s.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 text-blue-700 font-medium text-xs">
                          {s.items?.length || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {discrepancies > 0 ? (
                          <span className="text-red-600 font-medium">{discrepancies}</span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{new Date(s.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {s.status === 'draft' && (
                            <>
                              <button onClick={() => handleStatus(s.id, 'in_progress')}
                                className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded transition" title="Start counting">
                                <Play size={15} />
                              </button>
                              <button onClick={() => setDeleteId(s.id)}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition" title="Delete">
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                          {s.status === 'in_progress' && (
                            <>
                              <button onClick={() => setCountStocktakeId(s.id)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition" title="Count items">
                                <ClipboardCheck size={15} />
                              </button>
                              <button onClick={() => handleStatus(s.id, 'completed')}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded transition" title="Complete">
                                <CheckCircle2 size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-3">
            {data.data.map((s) => {
              const disc = s.items?.filter((i: any) => i.discrepancy !== null && i.discrepancy !== 0).length || 0;
              return (
                <div key={s.id} className="bg-white rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{s.location?.name}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s.status] || ''}`}>
                      {s.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {s.items?.length || 0} items · {disc > 0 ? <span className="text-red-600">{disc} discrepancies</span> : <span>no discrepancies</span>}
                  </div>
                  {s.status !== 'completed' && (
                    <div className="flex gap-2 pt-1">
                      {s.status === 'draft' && (
                        <button onClick={() => handleStatus(s.id, 'in_progress')}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-yellow-600 bg-yellow-50 rounded-lg">
                          <Play size={12} /> Start
                        </button>
                      )}
                      {s.status === 'in_progress' && (
                        <>
                          <button onClick={() => setCountStocktakeId(s.id)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg">
                            <ClipboardCheck size={12} /> Count
                          </button>
                          <button onClick={() => handleStatus(s.id, 'completed')}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-600 bg-green-50 rounded-lg">
                            <CheckCircle2 size={12} /> Complete
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
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

      <CreateStocktakeModal open={showCreate} onClose={() => setShowCreate(false)} />
      <StocktakeCountModal stocktakeId={countStocktakeId || ''} open={!!countStocktakeId} onClose={() => setCountStocktakeId(null)} />
      <ConfirmModal
        open={!!deleteId}
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Stocktake"
        message="Are you sure? This draft stocktake will be permanently deleted."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
