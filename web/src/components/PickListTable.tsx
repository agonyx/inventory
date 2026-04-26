import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Package,
  MapPin,
  Loader2,
  Box,
  Truck,
  Download,
} from 'lucide-react';
import { usePickList } from '../hooks/usePickList';
import { useUpdateOrderStatus } from '../hooks/useOrders';
import { openAuthenticatedUrl } from '../api/client';

export default function PickListTable() {
  const { data: items, isLoading, refetch, isFetching } = usePickList();
  const updateStatus = useUpdateOrderStatus();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Group items by location
  const grouped: Record<string, typeof items> = {};
  if (items) {
    for (const item of items) {
      if (!grouped[item.locationName]) grouped[item.locationName] = [];
      const arr = grouped[item.locationName];
      if (arr) arr.push(item);
    }
  }

  // Collect unique order IDs in the pick list
  const orderIds = new Map<string, { customerName: string; externalOrderId: string; status: string }>();
  if (items) {
    for (const item of items) {
      if (!orderIds.has(item.orderId)) {
        orderIds.set(item.orderId, {
          customerName: item.customerName,
          externalOrderId: item.externalOrderId,
          status: item.status,
        });
      }
    }
  }

  const toggleLocation = (loc: string) => {
    setCollapsed((prev) => ({ ...prev, [loc]: !prev[loc] }));
  };

  const handleMarkPacked = (orderId: string) => {
    updateStatus.mutate({ id: orderId, status: 'packed' });
  };

  const handleMarkShipped = (orderId: string) => {
    updateStatus.mutate({ id: orderId, status: 'shipped' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-blue-500" size={28} />
        <span className="ml-2 text-gray-500">Loading pick list...</span>
      </div>
    );
  }

  const locations = Object.keys(grouped);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {items?.length || 0} items across {locations.length} location{locations.length !== 1 ? 's' : ''} &middot; {orderIds.size} order{orderIds.size !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {!items?.length ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 py-16 text-center">
          <Package className="mx-auto text-gray-300" size={48} />
          <p className="text-gray-500 mt-3">No pending orders to pick.</p>
          <p className="text-gray-400 text-sm mt-1">New orders will appear here automatically.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {locations.map((loc) => {
            const locItems = grouped[loc] ?? [];
            const isCollapsed = !!collapsed[loc];

            return (
              <div key={loc} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Location header */}
                <button
                  onClick={() => toggleLocation(loc)}
                  className="w-full flex items-center gap-3 px-5 py-3 bg-gray-50 hover:bg-gray-100 transition text-left"
                >
                  {isCollapsed ? <ChevronRight size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                  <MapPin size={16} className="text-blue-500" />
                  <span className="font-semibold text-gray-800">{loc}</span>
                  <span className="text-xs text-gray-400 ml-1">
                    ({locItems[0]?.locationType || 'warehouse'})
                  </span>
                  <span className="ml-auto text-xs text-gray-400">{locItems.length} item{locItems.length !== 1 ? 's' : ''}</span>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      await openAuthenticatedUrl('/pick-list/pdf?location=' + encodeURIComponent(loc), { download: true });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition ml-3"
                  >
                    <Download size={14} />
                    Download PDF
                  </button>
                </button>

                {!isCollapsed && (
                  <>
                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-white">
                            <th className="px-5 py-2">Product</th>
                            <th className="px-5 py-2">Variant</th>
                            <th className="px-5 py-2">SKU</th>
                            <th className="px-5 py-2 text-center">Qty</th>
                            <th className="px-5 py-2">Customer</th>
                            <th className="px-5 py-2">Order</th>
                            <th className="px-5 py-2 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {locItems.map((item) => (
                            <tr key={`${item.orderId}-${item.sku}`} className="hover:bg-blue-50/50 transition-colors">
                              <td className="px-5 py-3 font-medium text-gray-900 text-base">
                                {item.productName}
                              </td>
                              <td className="px-5 py-3 text-gray-600">
                                {item.variantName}
                              </td>
                              <td className="px-5 py-3 text-gray-500 font-mono text-xs">
                                {item.sku}
                              </td>
                              <td className="px-5 py-3 text-center">
                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-base">
                                  {item.quantity}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-gray-700">{item.customerName}</td>
                              <td className="px-5 py-3 text-gray-400 font-mono text-xs">
                                {item.externalOrderId}
                              </td>
                              <td className="px-5 py-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleMarkPacked(item.orderId)}
                                    disabled={updateStatus.isPending}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-purple-700 bg-purple-100 rounded-lg hover:bg-purple-200 transition disabled:opacity-50"
                                  >
                                    <Box size={12} /> Packed
                                  </button>
                                  <button
                                    onClick={() => handleMarkShipped(item.orderId)}
                                    disabled={updateStatus.isPending}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 transition disabled:opacity-50"
                                  >
                                    <Truck size={12} /> Shipped
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile card layout */}
                    <div className="md:hidden divide-y divide-gray-100">
                      {locItems.map((item) => (
                        <div key={`${item.orderId}-${item.sku}`} className="px-4 py-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 text-sm truncate">{item.productName}</p>
                              <p className="text-xs text-gray-500">{item.variantName} · <span className="font-mono">{item.sku}</span></p>
                            </div>
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex-shrink-0">
                              {item.quantity}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <div className="text-gray-500">
                              <span className="text-gray-700">{item.customerName}</span> · <span className="font-mono">{item.externalOrderId}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleMarkPacked(item.orderId)}
                              disabled={updateStatus.isPending}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-purple-700 bg-purple-100 rounded-lg hover:bg-purple-200 transition disabled:opacity-50"
                            >
                              <Box size={12} /> Packed
                            </button>
                            <button
                              onClick={() => handleMarkShipped(item.orderId)}
                              disabled={updateStatus.isPending}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 transition disabled:opacity-50"
                            >
                              <Truck size={12} /> Shipped
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
