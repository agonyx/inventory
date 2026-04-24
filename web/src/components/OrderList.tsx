import { useState, Fragment } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  ClipboardList,
  AlertTriangle,
} from 'lucide-react';
import { useOrders, useUpdateOrderStatus, type Order } from '../hooks/useOrders';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

const STATUS_TABS = ['all', 'pending', 'confirmed', 'packed', 'shipped', 'cancelled'] as const;

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  packed: 'bg-purple-100 text-purple-700',
  shipped: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${color}`}>
      {status}
    </span>
  );
}

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

export default function OrderList() {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const statusFilter = activeTab === 'all' ? undefined : activeTab;

  const { data: orders, isLoading } = useOrders(statusFilter);
  const updateStatus = useUpdateOrderStatus();
  const { data: alerts = [] } = useQuery<LowStockAlert[]>({
    queryKey: ['alerts'],
    queryFn: () => apiFetch<LowStockAlert[]>('/alerts'),
    refetchInterval: 30000,
  });

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleStatusChange = (orderId: string, status: string) => {
    updateStatus.mutate({ id: orderId, status });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-blue-500" size={28} />
        <span className="ml-2 text-gray-500">Loading orders...</span>
      </div>
    );
  }

  return (
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
              <div key={`${a.variantId}-${a.locationId}`} className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm text-red-700 gap-0.5 sm:gap-0">
                <span>
                  <span className="font-medium">{a.productName}</span>
                  {' > '}{a.variantName} ({a.sku}) @ {a.locationName}
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

      {/* Status tabs - scrollable on mobile */}
      <div className="flex gap-0.5 sm:gap-1 border-b border-gray-200 pb-0 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-2.5 sm:px-3 py-2 text-xs sm:text-sm font-medium capitalize transition-colors border-b-2 -mb-px whitespace-nowrap ${
              activeTab === tab
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab}
            {tab !== 'all' && orders && (
              <span className="ml-1 text-xs text-gray-400">
                ({orders.filter((o) => o.status === tab).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Orders content */}
      {!orders?.length ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 py-16 text-center">
          <ClipboardList className="mx-auto text-gray-300" size={48} />
          <p className="text-gray-500 mt-3">No orders found.</p>
          <p className="text-gray-400 text-sm mt-1">
            {activeTab === 'all'
              ? 'Orders will appear here when synced from sales channels.'
              : `No ${activeTab} orders.`}
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

              return (
                <div key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
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
                      <span className="text-gray-400">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</span>
                    </div>
                  </button>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 mt-3 ml-6">
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
                                  <p className="font-medium text-gray-700 text-sm">{item.variant?.product?.name || 'Unknown'}</p>
                                  <p className="text-xs text-gray-500">{item.variant?.name || item.externalSku || 'N/A'}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="text-sm font-medium text-gray-700">${Number(item.unitPrice).toFixed(2)}</p>
                                  <p className="text-xs text-gray-400">× {item.quantity}</p>
                                </div>
                              </div>
                              <p className="text-xs text-gray-400 font-mono mt-0.5">{item.variant?.sku || item.externalSku || 'N/A'}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {order.shippingAddress && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <span className="text-xs font-medium text-gray-400 uppercase">Shipping Address</span>
                          <p className="text-sm text-gray-600 mt-0.5 whitespace-pre-line">{order.shippingAddress}</p>
                        </div>
                      )}
                    </div>
                  )}
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
                    <th className="w-8 px-4 py-3" />
                    <th className="px-4 py-3">Order ID</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-center">Items</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((order) => {
                    const isExpanded = expandedId === order.id;

                    return (
                      <OrderRow
                        key={order.id}
                        order={order}
                        isExpanded={isExpanded}
                        onToggle={() => toggleExpand(order.id)}
                        onStatusChange={handleStatusChange}
                        isUpdating={updateStatus.isPending}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
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
}: {
  order: Order;
  isExpanded: boolean;
  onToggle: () => void;
  onStatusChange: (id: string, status: string) => void;
  isUpdating: boolean;
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
        className="hover:bg-blue-50/50 transition-colors cursor-pointer"
        onClick={onToggle}
      >
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
          <td colSpan={9} className="p-0">
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
                  <p className="text-sm text-gray-600 mt-0.5 whitespace-pre-line">{order.shippingAddress}</p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
