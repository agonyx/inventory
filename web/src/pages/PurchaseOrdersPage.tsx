import { useState, useEffect } from 'react';
import { Plus, ShoppingCart, X, Send, PackageCheck, Ban, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import useUrlFilters from '../hooks/useUrlFilters';
import FilterBar from '../components/FilterBar';
import type { FilterConfig } from '../components/FilterBar';
import Pagination from '../components/Pagination';
import SkeletonTable from '../components/SkeletonTable';
import ConfirmModal from '../components/ConfirmModal';
import { useSuppliers } from '../hooks/useSuppliers';
import { useProducts } from '../hooks/useProducts';
import {
  usePurchaseOrders,
  usePurchaseOrder,
  useCreatePO,
  useUpdatePO,
  useSendPO,
  useReceivePO,
  useCancelPO,
  useDeletePO,
  type PurchaseOrder,
  type PurchaseOrderItem,
  type PurchaseOrderStatus,
} from '../hooks/usePurchaseOrders';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'partially_received', label: 'Partially Received' },
  { value: 'received', label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' },
];

const FILTER_CONFIG: FilterConfig[] = [
  { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
  { key: 'search', label: 'Search', type: 'search', placeholder: 'Search by supplier...' },
];

const STATUS_COLORS: Record<PurchaseOrderStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  partially_received: 'bg-yellow-100 text-yellow-700',
  received: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  partially_received: 'Partially Received',
  received: 'Received',
  cancelled: 'Cancelled',
};

interface CreateFormItem {
  variantId: string;
  quantity: number;
  unitCost: number;
}

export default function PurchaseOrdersPage() {
  const { filters, page, limit, setFilter, setPage, setLimit, resetFilters } = useUrlFilters();

  const params: Record<string, string> = {
    ...filters,
    page: String(page),
    limit: String(limit),
  };

  const { data, isLoading } = usePurchaseOrders(params);
  const orders = data?.data ?? [];
  const pagination = data?.pagination;

  const createPO = useCreatePO();
  const sendPO = useSendPO();
  const receivePO = useReceivePO();
  const cancelPO = useCancelPO();
  const deletePO = useDeletePO();

  const [createOpen, setCreateOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<PurchaseOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrder | null>(null);

  const { data: detailData } = usePurchaseOrder(detailOpen || '');

  const closeCreate = () => {
    setCreateOpen(false);
  };

  const openReceive = (id: string) => {
    setSelectedPO(id);
    setReceiveOpen(true);
  };

  const closeReceive = () => {
    setReceiveOpen(false);
    setSelectedPO(null);
  };

  const toggleDetail = (id: string) => {
    setDetailOpen((prev) => (prev === id ? null : id));
  };

  useEffect(() => {
    if (!createOpen && !receiveOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeCreate();
        closeReceive();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [createOpen, receiveOpen]);

  if (isLoading) {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Purchase Orders</h2>
        <SkeletonTable rows={5} columns={6} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-xl font-semibold">Purchase Orders</h2>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={14} />
          Create PO
        </button>
      </div>

      <div className="mb-4">
        <FilterBar
          filters={FILTER_CONFIG}
          values={filters}
          onChange={setFilter}
          onReset={resetFilters}
        />
      </div>

      {!orders.length ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 py-16 text-center">
          <ShoppingCart className="mx-auto text-gray-300" size={48} />
          <p className="text-gray-500 mt-3">No purchase orders found.</p>
          <p className="text-gray-400 text-sm mt-1">
            {Object.keys(filters).length === 0
              ? 'Create your first purchase order to start tracking procurement.'
              : 'No purchase orders match the current filters.'}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {orders.map((po) => (
              <div key={po.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => toggleDetail(po.id)}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="text-sm font-mono text-gray-500">
                      {po.id.slice(0, 8)}
                    </span>
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {po.supplier?.name || 'Unknown'}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[po.status]}`}>
                      {STATUS_LABELS[po.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span>{po.itemCount ?? 0} item{(po.itemCount ?? 0) !== 1 ? 's' : ''}</span>
                    {po.totalCost != null && (
                      <span className="font-medium">${Number(po.totalCost).toFixed(2)}</span>
                    )}
                    <span className="text-xs">{new Date(po.createdAt).toLocaleDateString()}</span>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {po.status === 'draft' && (
                        <>
                          <button
                            onClick={() => sendPO.mutate(po.id, { onSuccess: () => toast.success('PO sent'), onError: (err: any) => toast.error(err.message) })}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                          >
                            <Send size={12} /> Send
                          </button>
                          <button
                            onClick={() => setDeleteTarget(po)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                      {(po.status === 'sent' || po.status === 'partially_received') && (
                        <button
                          onClick={() => openReceive(po.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition"
                        >
                          <PackageCheck size={12} /> Receive
                        </button>
                      )}
                      {po.status !== 'cancelled' && po.status !== 'received' && po.status !== 'draft' && (
                        <button
                          onClick={() => setCancelTarget(po)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition"
                        >
                          <Ban size={12} />
                        </button>
                      )}
                    </div>
                    {detailOpen === po.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {detailOpen === po.id && (
                  <PODetail
                    po={detailData && detailData.id === po.id ? detailData : null}
                    onReceive={() => openReceive(po.id)}
                  />
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

      {createOpen && (
        <CreatePOModal onClose={closeCreate} onSubmit={createPO} />
      )}

      {receiveOpen && selectedPO && (
        <ReceiveModal
          poId={selectedPO}
          onClose={closeReceive}
          onSubmit={receivePO}
        />
      )}

      <ConfirmModal
        open={!!cancelTarget}
        title="Cancel Purchase Order"
        message={`Are you sure you want to cancel PO ${cancelTarget?.id?.slice(0, 8)}?`}
        confirmLabel="Cancel PO"
        variant="danger"
        onConfirm={() => {
          if (cancelTarget) cancelPO.mutate(cancelTarget.id, { onSuccess: () => { toast.success('PO cancelled'); setCancelTarget(null); }, onError: (err: any) => { toast.error(err.message); setCancelTarget(null); } });
        }}
        onCancel={() => setCancelTarget(null)}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Purchase Order"
        message={`Are you sure you want to delete draft PO ${deleteTarget?.id?.slice(0, 8)}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (deleteTarget) deletePO.mutate(deleteTarget.id, { onSuccess: () => { toast.success('PO deleted'); setDeleteTarget(null); }, onError: (err: any) => { toast.error(err.message); setDeleteTarget(null); } });
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function PODetail({ po, onReceive }: { po: PurchaseOrder | null; onReceive: () => void }) {
  if (!po) {
    return (
      <div className="px-4 py-6 text-center text-sm text-gray-400 border-t border-gray-100">
        Loading...
      </div>
    );
  }

  if (!po.items || po.items.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-gray-400 border-t border-gray-100">
        No items in this purchase order.
      </div>
    );
  }

  return (
    <div className="border-t border-gray-100">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-2">Variant</th>
              <th className="px-4 py-2">SKU</th>
              <th className="px-4 py-2 text-right">Ordered</th>
              <th className="px-4 py-2 text-right">Received</th>
              <th className="px-4 py-2 text-right">Unit Cost</th>
              <th className="px-4 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {po.items.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-2 text-gray-900">{item.variant?.name || item.variantId.slice(0, 8)}</td>
                <td className="px-4 py-2 text-gray-500 font-mono text-xs">{item.variant?.sku || '-'}</td>
                <td className="px-4 py-2 text-right text-gray-700">{item.quantity}</td>
                <td className="px-4 py-2 text-right">
                  <span className={item.receivedQuantity >= item.quantity ? 'text-green-600 font-medium' : item.receivedQuantity > 0 ? 'text-yellow-600 font-medium' : 'text-gray-400'}>
                    {item.receivedQuantity}
                  </span>
                </td>
                <td className="px-4 py-2 text-right text-gray-700">${Number(item.unitCost).toFixed(2)}</td>
                <td className="px-4 py-2 text-right text-gray-900 font-medium">${(item.quantity * Number(item.unitCost)).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(po.status === 'sent' || po.status === 'partially_received') && (
        <div className="px-4 py-3 border-t border-gray-50 flex justify-end">
          <button
            onClick={onReceive}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition"
          >
            <PackageCheck size={14} /> Receive Items
          </button>
        </div>
      )}
      {po.notes && (
        <div className="px-4 py-3 border-t border-gray-50 text-sm text-gray-500">
          <span className="font-medium">Notes:</span> {po.notes}
        </div>
      )}
    </div>
  );
}

function CreatePOModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: ReturnType<typeof useCreatePO>;
}) {
  const { data: suppliersData } = useSuppliers();
  const { data: productsData } = useProducts({ limit: '100' });
  const suppliers = suppliersData?.data ?? [];
  const products = productsData?.data ?? [];

  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<CreateFormItem[]>([
    { variantId: '', quantity: 1, unitCost: 0 },
  ]);
  const [error, setError] = useState<string | null>(null);

  const allVariants = products.flatMap((p) =>
    (p.variants || []).map((v) => ({
      id: v.id,
      label: `${p.name} - ${v.name}`,
      sku: v.sku,
    }))
  );

  const addItem = () => {
    setItems([...items, { variantId: '', quantity: 1, unitCost: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof CreateFormItem, value: string | number) => {
    setItems(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!supplierId) {
      setError('Please select a supplier.');
      return;
    }

    const validItems = items.filter((item) => item.variantId);
    if (validItems.length === 0) {
      setError('Please add at least one item with a variant selected.');
      return;
    }

    try {
      await onSubmit.mutateAsync({
        supplierId,
        notes: notes.trim() || undefined,
        items: validItems.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
          unitCost: item.unitCost,
        })),
      });
      toast.success('Purchase order created.');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create purchase order.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-none md:rounded-xl shadow-2xl w-full max-w-full md:max-w-2xl mx-0 md:mx-4 min-h-screen md:min-h-0 md:max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Create Purchase Order</h3>
          <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier <span className="text-red-500">*</span></label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select supplier...</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Optional notes..."
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Items <span className="text-red-500">*</span></label>
              <button type="button" onClick={addItem} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Add Item</button>
            </div>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="flex items-start gap-2">
                  <select
                    value={item.variantId}
                    onChange={(e) => updateItem(index, 'variantId', e.target.value)}
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select variant...</option>
                    {allVariants.map((v) => (
                      <option key={v.id} value={v.id}>{v.label} ({v.sku})</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                    className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Qty"
                    min={1}
                  />
                  <input
                    type="number"
                    value={item.unitCost}
                    onChange={(e) => updateItem(index, 'unitCost', parseFloat(e.target.value) || 0)}
                    className="w-24 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Cost"
                    min={0}
                    step={0.01}
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    disabled={items.length <= 1}
                    className="p-1.5 text-gray-400 hover:text-red-600 disabled:opacity-30 transition"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition">
              Cancel
            </button>
            <button
              type="submit"
              disabled={onSubmit.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition"
            >
              {onSubmit.isPending ? 'Creating...' : 'Create PO'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReceiveModal({
  poId,
  onClose,
  onSubmit,
}: {
  poId: string;
  onClose: () => void;
  onSubmit: ReturnType<typeof useReceivePO>;
}) {
  const { data: po } = usePurchaseOrder(poId);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  const items = po?.items || [];

  const handleQuantityChange = (itemId: string, value: string) => {
    setQuantities((prev) => ({ ...prev, [itemId]: parseInt(value) || 0 }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const receiveItems = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, quantityReceived]) => ({ itemId, quantityReceived }));

    if (receiveItems.length === 0) {
      setError('Please enter at least one quantity to receive.');
      return;
    }

    try {
      await onSubmit.mutateAsync({ id: poId, items: receiveItems });
      toast.success('Items received successfully.');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to receive items.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-none md:rounded-xl shadow-2xl w-full max-w-full md:max-w-lg mx-0 md:mx-4 min-h-screen md:min-h-0 md:max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Receive Items - PO {poId.slice(0, 8)}</h3>
          <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
          )}

          <div className="space-y-3">
            {items.map((item) => {
              const remaining = item.quantity - item.receivedQuantity;
              return (
                <div key={item.id} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.variant?.name || item.variantId.slice(0, 8)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Ordered: {item.quantity} | Already received: {item.receivedQuantity} | Remaining: {remaining}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500">Receive:</label>
                    <input
                      type="number"
                      value={quantities[item.id] || ''}
                      onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                      className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min={0}
                      max={remaining}
                      placeholder="0"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition">
              Cancel
            </button>
            <button
              type="submit"
              disabled={onSubmit.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg transition"
            >
              {onSubmit.isPending ? 'Receiving...' : 'Receive'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
