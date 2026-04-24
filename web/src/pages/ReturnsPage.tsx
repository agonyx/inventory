import { useState } from 'react';
import {
  RotateCcw,
  Plus,
  ChevronDown,
  ChevronRight,
  Check,
  XCircle,
  PackageCheck,
  CreditCard,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useReturns,
  useCreateReturn,
  useApproveReturn,
  useRejectReturn,
  useReceiveReturn,
  useRefundReturn,
  useDeleteReturn,
  type Return,
} from '../hooks/useReturns';
import { useOrders } from '../hooks/useOrders';
import FilterBar from '../components/FilterBar';
import type { FilterConfig } from '../components/FilterBar';
import Pagination from '../components/Pagination';
import ConfirmModal from '../components/ConfirmModal';
import SkeletonTable from '../components/SkeletonTable';
import useUrlFilters from '../hooks/useUrlFilters';

const STATUS_COLORS: Record<string, string> = {
  requested: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  received: 'bg-purple-100 text-purple-700',
  refunded: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const CONDITION_COLORS: Record<string, string> = {
  new: 'bg-green-100 text-green-700',
  used: 'bg-yellow-100 text-yellow-700',
  damaged: 'bg-red-100 text-red-700',
};

const FILTER_CONFIG: FilterConfig[] = [
  { key: 'search', label: 'Search', type: 'search', placeholder: 'Search returns...' },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'requested', label: 'Requested' },
      { value: 'approved', label: 'Approved' },
      { value: 'received', label: 'Received' },
      { value: 'refunded', label: 'Refunded' },
      { value: 'rejected', label: 'Rejected' },
    ],
  },
];

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${color}`}>
      {status}
    </span>
  );
}

function CreateReturnModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { data: ordersData } = useOrders({ limit: '50' });
  const createReturn = useCreateReturn();

  const [orderId, setOrderId] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedItems, setSelectedItems] = useState<
    Record<string, { quantity: number; condition: string }>
  >({});

  const selectedOrder = ordersData?.data?.find((o) => o.id === orderId);

  const handleSubmit = () => {
    if (!orderId || !reason) return;
    const items = Object.entries(selectedItems)
      .filter(([, v]) => v.quantity > 0)
      .map(([variantId, v]) => ({
        variantId,
        quantity: v.quantity,
        condition: v.condition,
      }));
    if (items.length === 0) {
      toast.error('Select at least one item');
      return;
    }
    createReturn.mutate(
      { orderId, reason, notes: notes || undefined, items },
      {
        onSuccess: () => {
          toast.success('Return created');
          onClose();
          setOrderId('');
          setReason('');
          setNotes('');
          setSelectedItems({});
        },
        onError: (err: any) => toast.error(err?.message || 'Failed to create return'),
      },
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-lg border border-gray-200 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto p-6">
        <h3 className="text-lg font-semibold text-gray-900">Create Return</h3>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
            <select
              value={orderId}
              onChange={(e) => {
                setOrderId(e.target.value);
                setSelectedItems({});
              }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select an order</option>
              {ordersData?.data?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.externalOrderId} — {o.customerName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Reason for return..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Additional notes..."
            />
          </div>

          {selectedOrder && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Items</label>
              <div className="space-y-2">
                {selectedOrder.items.map((item) => {
                  const sel = selectedItems[item.variantId || ''] || {
                    quantity: 0,
                    condition: 'new',
                  };
                  return (
                    <div key={item.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={sel.quantity > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedItems((prev) => ({
                              ...prev,
                              [item.variantId || '']: {
                                quantity: item.quantity,
                                condition: 'new',
                              },
                            }));
                          } else {
                            setSelectedItems((prev) => {
                              const next = { ...prev };
                              delete next[item.variantId || ''];
                              return next;
                            });
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="flex-1 text-gray-700">
                        {item.variant?.product?.name || 'Unknown'} / {item.variant?.name || 'N/A'}
                      </span>
                      {sel.quantity > 0 && (
                        <>
                          <input
                            type="number"
                            min={1}
                            max={item.quantity}
                            value={sel.quantity}
                            onChange={(e) =>
                              setSelectedItems((prev) => ({
                                ...prev,
                                [item.variantId || '']: {
                                  ...prev[item.variantId || ''],
                                  quantity: Math.min(Number(e.target.value), item.quantity),
                                },
                              }))
                            }
                            className="w-16 border border-gray-200 rounded px-2 py-1 text-sm text-center"
                          />
                          <select
                            value={sel.condition}
                            onChange={(e) =>
                              setSelectedItems((prev) => ({
                                ...prev,
                                [item.variantId || '']: {
                                  ...prev[item.variantId || ''],
                                  condition: e.target.value,
                                },
                              }))
                            }
                            className="border border-gray-200 rounded px-2 py-1 text-sm"
                          >
                            <option value="new">New</option>
                            <option value="used">Used</option>
                            <option value="damaged">Damaged</option>
                          </select>
                        </>
                      )}
                      <span className="text-gray-400 text-xs">max {item.quantity}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createReturn.isPending || !orderId || !reason}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {createReturn.isPending ? 'Creating...' : 'Create Return'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReturnsPage() {
  const { filters, page, limit, setFilter, setPage, setLimit, resetFilters } = useUrlFilters();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const params: Record<string, string> = {
    page: String(page),
    limit: String(limit),
    ...(filters.status && { status: filters.status }),
    ...(filters.search && { search: filters.search }),
  };

  const { data, isLoading } = useReturns(params);
  const returns = data?.data ?? [];
  const pagination = data?.pagination;

  const approveReturn = useApproveReturn();
  const rejectReturn = useRejectReturn();
  const receiveReturn = useReceiveReturn();
  const refundReturn = useRefundReturn();
  const deleteReturn = useDeleteReturn();

  const handleAction = (
    mutation: ReturnType<typeof useApproveReturn>,
    id: string,
    label: string,
  ) => {
    mutation.mutate(id, {
      onSuccess: () => toast.success(`Return ${label}`),
      onError: (err: any) => toast.error(err?.message || `Failed to ${label}`),
    });
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteReturn.mutate(deleteId, {
      onSuccess: () => {
        toast.success('Return deleted');
        setDeleteId(null);
      },
      onError: (err: any) => toast.error(err?.message || 'Failed to delete'),
    });
  };

  if (isLoading) {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Returns</h2>
        <SkeletonTable rows={8} columns={6} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <RotateCcw size={20} className="text-blue-600" /> Returns / RMAs
        </h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={16} /> New Return
        </button>
      </div>

      <FilterBar
        filters={FILTER_CONFIG}
        values={filters}
        onChange={setFilter}
        onReset={resetFilters}
      />

      {!returns.length ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 py-16 text-center">
          <RotateCcw className="mx-auto text-gray-300" size={48} />
          <p className="text-gray-500 mt-3">No returns found.</p>
          <p className="text-gray-400 text-sm mt-1">
            {Object.keys(filters).length === 0
              ? 'Create a return from an existing order.'
              : 'No returns match the current filters.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="w-8 px-4 py-3" />
                    <th className="px-4 py-3">Return #</th>
                    <th className="px-4 py-3">Order #</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Items</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {returns.map((ret) => {
                    const isExpanded = expandedId === ret.id;
                    return (
                      <ReturnRow
                        key={ret.id}
                        ret={ret}
                        isExpanded={isExpanded}
                        onToggle={() => setExpandedId((prev) => (prev === ret.id ? null : ret.id))}
                        onApprove={() => handleAction(approveReturn, ret.id, 'approved')}
                        onReject={() => handleAction(rejectReturn, ret.id, 'rejected')}
                        onReceive={() => handleAction(receiveReturn, ret.id, 'received')}
                        onRefund={() => handleAction(refundReturn, ret.id, 'refunded')}
                        onDelete={() => setDeleteId(ret.id)}
                        isPending={
                          approveReturn.isPending ||
                          rejectReturn.isPending ||
                          receiveReturn.isPending ||
                          refundReturn.isPending
                        }
                      />
                    );
                  })}
                </tbody>
              </table>
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
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {returns.map((ret) => (
              <div key={ret.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-gray-500">{ret.id.slice(0, 8)}</span>
                  <StatusBadge status={ret.status} />
                </div>
                <div className="text-sm">
                  <span className="text-gray-500">Order:</span>{' '}
                  <span className="font-medium">{ret.order?.externalOrderId || ret.orderId.slice(0, 8)}</span>
                </div>
                <p className="text-sm text-gray-700 line-clamp-2">{ret.reason}</p>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>{ret.items?.length || 0} items</span>
                  <span>&middot;</span>
                  <span>{new Date(ret.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {ret.status === 'requested' && (
                    <>
                      <button
                        onClick={() => handleAction(approveReturn, ret.id, 'approved')}
                        disabled={approveReturn.isPending}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition disabled:opacity-50"
                      >
                        <Check size={12} /> Approve
                      </button>
                      <button
                        onClick={() => handleAction(rejectReturn, ret.id, 'rejected')}
                        disabled={rejectReturn.isPending}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition disabled:opacity-50"
                      >
                        <XCircle size={12} /> Reject
                      </button>
                    </>
                  )}
                  {ret.status === 'approved' && (
                    <button
                      onClick={() => handleAction(receiveReturn, ret.id, 'received')}
                      disabled={receiveReturn.isPending}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition disabled:opacity-50"
                    >
                      <PackageCheck size={12} /> Receive
                    </button>
                  )}
                  {ret.status === 'received' && (
                    <button
                      onClick={() => handleAction(refundReturn, ret.id, 'refunded')}
                      disabled={refundReturn.isPending}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition disabled:opacity-50"
                    >
                      <CreditCard size={12} /> Refund
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {pagination && (
            <div className="md:hidden">
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                limit={pagination.limit}
                onPageChange={setPage}
                onLimitChange={setLimit}
              />
            </div>
          )}
        </>
      )}

      <CreateReturnModal open={showCreate} onClose={() => setShowCreate(false)} />
      <ConfirmModal
        open={!!deleteId}
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Return"
        message="Are you sure you want to delete this return request?"
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

function ReturnRow({
  ret,
  isExpanded,
  onToggle,
  onApprove,
  onReject,
  onReceive,
  onRefund,
  onDelete,
  isPending,
}: {
  ret: Return;
  isExpanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReject: () => void;
  onReceive: () => void;
  onRefund: () => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  return (
    <>
      <tr
        className={`hover:bg-blue-50/50 transition-colors cursor-pointer ${isExpanded ? 'bg-blue-50/30' : ''}`}
        onClick={onToggle}
      >
        <td className="px-4 py-3 text-gray-400">
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </td>
        <td className="px-4 py-3 font-mono text-xs text-gray-600">{ret.id.slice(0, 8)}</td>
        <td className="px-4 py-3 font-mono text-xs text-gray-600">
          {ret.order?.externalOrderId || ret.orderId.slice(0, 8)}
        </td>
        <td className="px-4 py-3 text-gray-700 max-w-[200px] truncate">{ret.reason}</td>
        <td className="px-4 py-3 text-center">
          <StatusBadge status={ret.status} />
        </td>
        <td className="px-4 py-3 text-center">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 text-blue-700 font-medium text-xs">
            {ret.items?.length || 0}
          </span>
        </td>
        <td className="px-4 py-3 text-gray-400 text-xs">
          {new Date(ret.createdAt).toLocaleDateString()}
        </td>
        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            {ret.status === 'requested' && (
              <>
                <button
                  onClick={onApprove}
                  disabled={isPending}
                  className="p-1.5 text-green-600 hover:bg-green-50 rounded transition"
                  title="Approve"
                >
                  <Check size={15} />
                </button>
                <button
                  onClick={onReject}
                  disabled={isPending}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded transition"
                  title="Reject"
                >
                  <XCircle size={15} />
                </button>
                <button
                  onClick={onDelete}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition"
                  title="Delete"
                >
                  <Trash2 size={15} />
                </button>
              </>
            )}
            {ret.status === 'approved' && (
              <button
                onClick={onReceive}
                disabled={isPending}
                className="p-1.5 text-purple-600 hover:bg-purple-50 rounded transition"
                title="Receive"
              >
                <PackageCheck size={15} />
              </button>
            )}
            {ret.status === 'received' && (
              <button
                onClick={onRefund}
                disabled={isPending}
                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                title="Refund"
              >
                <CreditCard size={15} />
              </button>
            )}
          </div>
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={8} className="p-0">
            <div className="bg-gray-50/80 px-12 py-4">
              {ret.notes && (
                <p className="text-sm text-gray-600 mb-3">
                  <span className="font-medium text-gray-400 uppercase text-xs">Notes:</span>{' '}
                  {ret.notes}
                </p>
              )}
              {!ret.items?.length ? (
                <p className="text-gray-400 text-sm italic">No items.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      <th className="pb-2 pr-4">Product</th>
                      <th className="pb-2 pr-4">Variant</th>
                      <th className="pb-2 pr-4">SKU</th>
                      <th className="pb-2 pr-4 text-right">Qty</th>
                      <th className="pb-2 text-center">Condition</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {ret.items.map((item) => (
                      <tr key={item.id} className="hover:bg-white transition-colors">
                        <td className="py-2 pr-4 text-gray-700 font-medium">
                          {item.variant?.product?.name || 'Unknown'}
                        </td>
                        <td className="py-2 pr-4 text-gray-500">
                          {item.variant?.name || 'N/A'}
                        </td>
                        <td className="py-2 pr-4 text-gray-500 font-mono text-xs">
                          {item.variant?.sku || 'N/A'}
                        </td>
                        <td className="py-2 pr-4 text-right text-gray-700 font-medium">
                          {item.quantity}
                        </td>
                        <td className="py-2 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${CONDITION_COLORS[item.condition] || ''}`}
                          >
                            {item.condition}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
