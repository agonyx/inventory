import { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  AlertTriangle,
  Download,
  X,
  ExternalLink,
  Truck,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch, openAuthenticatedUrl } from '../api/client';
import { useOrders, useUpdateOrderStatus, useUpdateShipping, useOrderTrackingUrl, type Order } from '../hooks/useOrders';
import { useAuth } from '../hooks/useAuth';
import { useBulkUpdateOrderStatus } from '../hooks/useBulkOperations';
import useUrlFilters from '../hooks/useUrlFilters';
import FilterBar from '../components/FilterBar';
import type { FilterConfig } from '../components/FilterBar';
import Pagination from '../components/Pagination';
import SortableHeader from '../components/SortableHeader';
import SkeletonTable from '../components/SkeletonTable';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  packed: 'bg-purple-100 text-purple-700',
  shipped: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'packed', label: 'Packed' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'cancelled', label: 'Cancelled' },
];

const CARRIER_OPTIONS = [
  { value: 'dhl', label: 'DHL' },
  { value: 'ups', label: 'UPS' },
  { value: 'fedex', label: 'FedEx' },
  { value: 'usps', label: 'USPS' },
  { value: 'royal_mail', label: 'Royal Mail' },
];

const CARRIER_URLS: Record<string, (tracking: string) => string> = {
  dhl: (t) => `https://www.dhl.com/track?id=${encodeURIComponent(t)}`,
  ups: (t) => `https://www.ups.com/track?tracknum=${encodeURIComponent(t)}`,
  fedex: (t) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(t)}`,
  usps: (t) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(t)}`,
  royal_mail: (t) => `https://www.royalmail.com/track-your-item/?trackNumber=${encodeURIComponent(t)}`,
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${color}`}>
      {status}
    </span>
  );
}

function ShippingSection({ order }: { order: Order }) {
  const { data: user } = useAuth();
  const updateShipping = useUpdateShipping();
  const [trackingInput, setTrackingInput] = useState(order.trackingNumber || '');
  const [carrierInput, setCarrierInput] = useState(order.shippingCarrier || 'ups');

  const canEdit = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'warehouse';

  const handleSave = () => {
    updateShipping.mutate(
      { id: order.id, trackingNumber: trackingInput, shippingCarrier: carrierInput },
      {
        onSuccess: () => {
          toast.success('Shipping info updated');
        },
        onError: (err: any) => {
          toast.error(err.message || 'Failed to update shipping info');
        },
      },
    );
  };

  const trackingUrl =
    order.trackingNumber && order.shippingCarrier && CARRIER_URLS[order.shippingCarrier]
      ? CARRIER_URLS[order.shippingCarrier](order.trackingNumber)
      : null;

  return (
    <div className="mt-3 pt-3 border-t border-gray-200">
      <span className="text-xs font-medium text-gray-400 uppercase flex items-center gap-1">
        <Truck size={12} />
        Shipping
      </span>

      {order.trackingNumber && (
        <div className="mt-1.5">
          <p className="text-sm text-gray-600">
            {(CARRIER_OPTIONS.find((c) => c.value === order.shippingCarrier)?.label || order.shippingCarrier?.toUpperCase())}: {order.trackingNumber}
          </p>
          {trackingUrl && (
            <a
              href={trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mt-1"
            >
              <ExternalLink size={14} />
              Track Package
            </a>
          )}
        </div>
      )}

      {canEdit && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div>
            <label className="text-xs text-gray-500">Tracking Number</label>
            <input
              type="text"
              value={trackingInput}
              onChange={(e) => setTrackingInput(e.target.value)}
              className="block w-48 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter tracking number"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Carrier</label>
            <select
              value={carrierInput}
              onChange={(e) => setCarrierInput(e.target.value)}
              className="block text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-blue-500 focus:border-blue-500"
            >
              {CARRIER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSave}
            disabled={updateShipping.isPending || !trackingInput.trim()}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {updateShipping.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}

const FILTER_CONFIG: FilterConfig[] = [
  { key: 'search', label: 'Search', type: 'search', placeholder: 'Search orders...' },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'pending', label: 'Pending' },
      { value: 'confirmed', label: 'Confirmed' },
      { value: 'packed', label: 'Packed' },
      { value: 'shipped', label: 'Shipped' },
      { value: 'cancelled', label: 'Cancelled' },
    ],
  },
  {
    key: 'source',
    label: 'Source',
    type: 'select',
    options: [
      { value: 'shopify', label: 'Shopify' },
      { value: 'etsy', label: 'Etsy' },
      { value: 'woocommerce', label: 'WooCommerce' },
      { value: 'amazon', label: 'Amazon' },
      { value: 'other', label: 'Other' },
    ],
  },
  { key: 'date', label: 'Order Date', type: 'date-range' },
];

interface LowStockAlert {
  productId: string;
  productName: string;
  sku: string;
  variantId: string;
  variantName: string;
  locationId: string;
  locationName: string;
  currentQuantity: number;
  threshold: number;
  deficit: number;
}

export default function OrdersPage() {
  const { filters, sort, page, limit, setFilter, removeFilter, setSort, setPage, setLimit, resetFilters } =
    useUrlFilters();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Build query params from URL filters + sort + pagination
  const params: Record<string, string> = {
    ...filters,
    page: String(page),
    limit: String(limit),
  };
  if (sort.sortBy) {
    params.sortBy = sort.sortBy;
    params.sortDir = sort.sortDir;
  }

  const { data, isLoading } = useOrders(params);
  const orders = data?.data ?? [];
  const pagination = data?.pagination;

  const updateStatus = useUpdateOrderStatus();
  const bulkUpdateStatus = useBulkUpdateOrderStatus();

  const { data: alerts = [] } = useQuery<LowStockAlert[]>({
    queryKey: ['alerts'],
    queryFn: () => apiFetch<LowStockAlert[]>('/alerts'),
    refetchInterval: 30000,
  });

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('confirmed');

  useEffect(() => {
    setSelectedIds(new Set());
  }, [orders]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map((o) => o.id)));
    }
  };

  const allSelected = orders.length > 0 && selectedIds.size === orders.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const handleBulkStatusUpdate = () => {
    bulkUpdateStatus.mutate(
      { ids: Array.from(selectedIds), status: bulkStatus },
      {
        onSuccess: (data: { updated: number }) => {
          toast.success(`${data.updated} order(s) updated to ${bulkStatus}`);
          setSelectedIds(new Set());
        },
        onError: (err: any) => {
          toast.error(err.message || 'Failed to update order statuses');
        },
      },
    );
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleStatusChange = (orderId: string, status: string) => {
    updateStatus.mutate(
      { id: orderId, status },
      {
        onSuccess: () => {
          toast.success(`Order status updated to ${status}`);
        },
      },
    );
  };

  const handleExportCsv = () => {
    const qs = Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : '';
    window.open(`/api/orders/export${qs}`, '_blank');
  };

  // Combine filter values (flat filters plus date-range sub-keys) for FilterBar
  const filterValues: Record<string, string> = {
    ...filters,
    ...(filters.date_from ? { date_from: filters.date_from } : {}),
    ...(filters.date_to ? { date_to: filters.date_to } : {}),
  };

  if (isLoading) {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Orders</h2>
        <SkeletonTable rows={8} columns={9} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-xl font-semibold">Orders</h2>
        <button
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>

      {/* FilterBar */}
      <div className="mb-4">
        <FilterBar
          filters={FILTER_CONFIG}
          values={filterValues}
          onChange={(key, value) => setFilter(key, value)}
          onReset={resetFilters}
        />
      </div>

      <div className="space-y-4">
        {/* Low stock alerts */}
        {alerts.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 md:p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-red-500" />
              <span className="font-semibold text-red-700 text-sm">
                Low Stock Alerts ({alerts.length})
              </span>
            </div>
            <div className="space-y-1">
              {alerts.slice(0, 5).map((a) => (
                <div
                  key={`${a.variantId}-${a.locationId}`}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm text-red-700 gap-0.5 sm:gap-0"
                >
                  <span>
                    <span className="font-medium">{a.productName}</span>
                    {' > '}
                    {a.variantName} ({a.sku}) @ {a.locationName}
                  </span>
                  <span className="font-semibold">
                    {a.currentQuantity}/{a.threshold}
                  </span>
                </div>
              ))}
              {alerts.length > 5 && (
                <p className="text-xs text-red-500 mt-1">...and {alerts.length - 5} more</p>
              )}
            </div>
          </div>
        )}

        {/* Orders content */}
        {!orders.length ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 py-16 text-center">
            <ClipboardList className="mx-auto text-gray-300" size={48} />
            <p className="text-gray-500 mt-3">No orders found.</p>
            <p className="text-gray-400 text-sm mt-1">
              {Object.keys(filters).length === 0
                ? 'Orders will appear here when synced from sales channels.'
                : 'No orders match the current filters.'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile card layout */}
            <div className="md:hidden space-y-3">
              {orders.map((order) => {
                const isExpanded = expandedId === order.id;
                const canAdvance = order.status !== 'shipped' && order.status !== 'cancelled';
                const nextStatus: Record<string, string> = {
                  pending: 'confirmed',
                  confirmed: 'packed',
                  packed: 'shipped',
                  shipped: 'shipped',
                  cancelled: 'cancelled',
                };
                const nextLabel: Record<string, string> = {
                  pending: 'Confirm',
                  confirmed: 'Pack',
                  packed: 'Ship',
                  shipped: 'Done',
                  cancelled: 'Cancelled',
                };
                const next = nextStatus[order.status];
                const isSelected = selectedIds.has(order.id);

                return (
                  <div key={order.id} className={`bg-white rounded-xl shadow-sm border border-gray-200 p-4 ${isSelected ? 'ring-2 ring-blue-500' : ''}`}>
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleSelect(order.id);
                        }}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => toggleExpand(order.id)}
                          className="w-full text-left"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {isExpanded ? (
                                <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
                              ) : (
                                <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                              )}
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900 truncate">{order.customerName}</p>
                                <p className="text-xs text-gray-400 truncate">{order.customerEmail}</p>
                              </div>
                            </div>
                            <StatusBadge status={order.status} />
                          </div>
                          <div className="flex items-center gap-3 mt-2 ml-6 text-sm">
                            <span className="text-gray-500 font-mono text-xs">{order.externalOrderId}</span>
                            <span className="text-gray-700 font-medium">${Number(order.totalAmount).toFixed(2)}</span>
                            <span className="text-gray-400">
                              {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </button>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 mt-3 ml-6">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openAuthenticatedUrl(`/orders/${order.id}/packing-slip`);
                            }}
                            className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                          >
                            <Download size={12} className="inline mr-0.5" />
                            Packing Slip
                          </button>
                          {canAdvance && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(order.id, next);
                              }}
                              disabled={updateStatus.isPending}
                              className="px-2.5 py-1 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                            >
                              {nextLabel[order.status]}
                            </button>
                          )}
                          {order.status !== 'cancelled' && order.status !== 'shipped' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(order.id, 'cancelled');
                              }}
                              disabled={updateStatus.isPending}
                              className="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          )}
                        </div>

                        {/* Expanded items (mobile) */}
                        {isExpanded && (
                          <div className="mt-3 ml-6 bg-gray-50 rounded-lg p-3">
                            {order.items.length === 0 ? (
                              <p className="text-gray-400 text-sm italic">No items.</p>
                            ) : (
                              <div className="space-y-2">
                                {order.items.map((item) => (
                                  <div key={item.id} className="bg-white rounded-md p-2.5 border border-gray-100">
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <p className="font-medium text-gray-700 text-sm">
                                          {item.variant?.product?.name || 'Unknown'}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          {item.variant?.name || item.externalSku || 'N/A'}
                                        </p>
                                      </div>
                                      <div className="text-right flex-shrink-0">
                                        <p className="text-sm font-medium text-gray-700">
                                          ${Number(item.unitPrice).toFixed(2)}
                                        </p>
                                        <p className="text-xs text-gray-400">× {item.quantity}</p>
                                      </div>
                                    </div>
                                    <p className="text-xs text-gray-400 font-mono mt-0.5">
                                      {item.variant?.sku || item.externalSku || 'N/A'}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                            {order.shippingAddress && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <span className="text-xs font-medium text-gray-400 uppercase">Shipping Address</span>
                                <p className="text-sm text-gray-600 mt-0.5 whitespace-pre-line">
                                  {order.shippingAddress}
                                </p>
                              </div>
                            )}
                            {isExpanded && <ShippingSection order={order} />}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <th className="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = someSelected;
                          }}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="w-8 px-4 py-3" />
                      <th className="px-4 py-3">Order ID</th>
                      <SortableHeader
                        label="Customer"
                        column="customerName"
                        currentSortBy={sort.sortBy}
                        currentSortDir={sort.sortDir as 'ASC' | 'DESC' | undefined}
                        onSort={setSort}
                      />
                      <th className="px-4 py-3">Source</th>
                      <SortableHeader
                        label="Total"
                        column="totalAmount"
                        currentSortBy={sort.sortBy}
                        currentSortDir={sort.sortDir as 'ASC' | 'DESC' | undefined}
                        onSort={setSort}
                      />
                      <th className="px-4 py-3 text-center">Items</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <SortableHeader
                        label="Date"
                        column="createdAt"
                        currentSortBy={sort.sortBy}
                        currentSortDir={sort.sortDir as 'ASC' | 'DESC' | undefined}
                        onSort={setSort}
                      />
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orders.map((order) => {
                      const isExpanded = expandedId === order.id;
                      const isSelected = selectedIds.has(order.id);

                      return (
                        <OrderRow
                          key={order.id}
                          order={order}
                          isExpanded={isExpanded}
                          onToggle={() => toggleExpand(order.id)}
                          onStatusChange={handleStatusChange}
                          isUpdating={updateStatus.isPending}
                          isSelected={isSelected}
                          onToggleSelect={toggleSelect}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
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

            {/* Mobile pagination */}
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
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-gray-900 text-white px-5 py-3 rounded-xl shadow-lg">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="p-1 hover:bg-gray-700 rounded transition"
            title="Clear selection"
          >
            <X size={16} />
          </button>
          <div className="w-px h-5 bg-gray-600" />
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
            className="bg-gray-800 text-white text-sm rounded-lg px-2 py-1.5 border border-gray-600 focus:ring-blue-500 focus:border-blue-500"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleBulkStatusUpdate}
            disabled={bulkUpdateStatus.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition"
          >
            {bulkUpdateStatus.isPending ? 'Updating...' : 'Update Status'}
          </button>
        </div>
      )}
    </div>
  );
}

function OrderRow({
  order,
  isExpanded,
  onToggle,
  onStatusChange,
  isUpdating,
  isSelected,
  onToggleSelect,
}: {
  order: Order;
  isExpanded: boolean;
  onToggle: () => void;
  onStatusChange: (id: string, status: string) => void;
  isUpdating: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const nextStatus: Record<string, string> = {
    pending: 'confirmed',
    confirmed: 'packed',
    packed: 'shipped',
    shipped: 'shipped',
    cancelled: 'cancelled',
  };

  const nextLabel: Record<string, string> = {
    pending: 'Confirm',
    confirmed: 'Pack',
    packed: 'Ship',
    shipped: 'Done',
    cancelled: 'Cancelled',
  };

  const canAdvance = order.status !== 'shipped' && order.status !== 'cancelled';
  const next = nextStatus[order.status];

  return (
    <>
      <tr
        className={`hover:bg-blue-50/50 transition-colors cursor-pointer ${
          isExpanded ? 'bg-blue-50/30' : ''
        } ${isSelected ? 'bg-blue-50/60' : ''}`}
        onClick={onToggle}
      >
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(order.id)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        </td>
        <td className="px-4 py-3 text-gray-400">
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </td>
        <td className="px-4 py-3 font-mono text-xs text-gray-600">
          {order.externalOrderId}
        </td>
        <td className="px-4 py-3">
          <div className="font-medium text-gray-900">{order.customerName}</div>
          <div className="text-xs text-gray-400">{order.customerEmail}</div>
        </td>
        <td className="px-4 py-3 text-gray-500">
          {order.source ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 capitalize">
              {order.source}
            </span>
          ) : (
            <span className="text-gray-300">&mdash;</span>
          )}
        </td>
        <td className="px-4 py-3 text-right font-medium text-gray-900">
          ${Number(order.totalAmount).toFixed(2)}
        </td>
        <td className="px-4 py-3 text-center text-gray-500">
          {order.items.length}
        </td>
        <td className="px-4 py-3 text-center">
          <StatusBadge status={order.status} />
        </td>
        <td className="px-4 py-3 text-gray-400 text-xs">
          {new Date(order.createdAt).toLocaleDateString()}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                openAuthenticatedUrl(`/orders/${order.id}/packing-slip`);
              }}
              className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
              title="Download Packing Slip"
            >
              <Download size={12} />
            </button>
            {canAdvance && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange(order.id, next);
                }}
                disabled={isUpdating}
                className="px-2.5 py-1 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {nextLabel[order.status]}
              </button>
            )}
            {order.status !== 'cancelled' && order.status !== 'shipped' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange(order.id, 'cancelled');
                }}
                disabled={isUpdating}
                className="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition disabled:opacity-50"
              >
                Cancel
              </button>
            )}
          </div>
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={10} className="p-0">
            <div className="bg-gray-50/80 px-12 py-4">
              {order.items.length === 0 ? (
                <p className="text-gray-400 text-sm italic">No items.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      <th className="pb-2 pr-4">Product</th>
                      <th className="pb-2 pr-4">Variant</th>
                      <th className="pb-2 pr-4">SKU</th>
                      <th className="pb-2 pr-4 text-right">Qty</th>
                      <th className="pb-2 text-right">Unit Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {order.items.map((item) => (
                      <tr key={item.id} className="hover:bg-white transition-colors">
                        <td className="py-2 pr-4 text-gray-700 font-medium">
                          {item.variant?.product?.name || 'Unknown'}
                        </td>
                        <td className="py-2 pr-4 text-gray-500">
                          {item.variant?.name || item.externalSku || 'N/A'}
                        </td>
                        <td className="py-2 pr-4 text-gray-500 font-mono text-xs">
                          {item.variant?.sku || item.externalSku || 'N/A'}
                        </td>
                        <td className="py-2 pr-4 text-right text-gray-700 font-medium">
                          {item.quantity}
                        </td>
                        <td className="py-2 text-right text-gray-700">
                          ${Number(item.unitPrice).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {order.shippingAddress && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <span className="text-xs font-medium text-gray-400 uppercase">Shipping Address</span>
                  <p className="text-sm text-gray-600 mt-0.5 whitespace-pre-line">
                    {order.shippingAddress}
                  </p>
                </div>
              )}
              <ShippingSection order={order} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
