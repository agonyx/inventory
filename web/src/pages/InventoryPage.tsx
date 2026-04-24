import { useState } from 'react';
import { Download, Warehouse, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import useUrlFilters from '../hooks/useUrlFilters';
import FilterBar from '../components/FilterBar';
import type { FilterConfig } from '../components/FilterBar';
import Pagination from '../components/Pagination';
import SortableHeader from '../components/SortableHeader';
import SkeletonTable from '../components/SkeletonTable';
import StockAdjustDialog from '../components/StockAdjustDialog';
import { useInventory, type InventoryLevel } from '../hooks/useInventory';
import { useLocations } from '../hooks/useLocations';
import type { Product, ProductVariant } from '../hooks/useProducts';

const FILTER_CONFIG: FilterConfig[] = [
  { key: 'search', label: 'Search', type: 'search', placeholder: 'Search products/variants...' },
  { key: 'locationId', label: 'Location', type: 'select', options: [] },
  {
    key: 'lowStock',
    label: 'Stock Status',
    type: 'select',
    options: [
      { value: 'low', label: 'Low Stock' },
      { value: 'in', label: 'In Stock' },
    ],
  },
];

export default function InventoryPage() {
  const { filters, sort, page, limit, setFilter, setSort, setPage, setLimit, resetFilters } = useUrlFilters();

  // Fetch locations for the filter dropdown
  const { data: locationsData } = useLocations({ limit: '200' });
  const locationOptions =
    locationsData?.data?.map((l) => ({ value: l.id, label: l.name })) ?? [];

  // Build filter config with dynamic location options
  const filterConfig: FilterConfig[] = FILTER_CONFIG.map((f) =>
    f.key === 'locationId' ? { ...f, options: locationOptions } : f,
  );

  // Build query params
  const params: Record<string, string> = {
    ...filters,
    page: String(page),
    limit: String(limit),
  };
  if (sort.sortBy) {
    params.sortBy = sort.sortBy;
    params.sortDir = sort.sortDir;
  }

  const { data, isLoading } = useInventory(params);
  const inventoryLevels = data?.data ?? [];
  const pagination = data?.pagination;

  // Stock adjust dialog
  const [adjustTarget, setAdjustTarget] = useState<InventoryLevel | null>(null);

  const handleExportCsv = () => {
    const qs = Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : '';
    window.open(`/api/inventory/export${qs}`, '_blank');
  };

  if (isLoading) {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Inventory</h2>
        <SkeletonTable rows={8} columns={8} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-xl font-semibold">Inventory</h2>
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
          filters={filterConfig}
          values={filters}
          onChange={setFilter}
          onReset={resetFilters}
        />
      </div>

      {/* Content */}
      {!inventoryLevels.length ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 py-16 text-center">
          <Warehouse className="mx-auto text-gray-300" size={48} />
          <p className="text-gray-500 mt-3">No inventory records found.</p>
          <p className="text-gray-400 text-sm mt-1">
            {Object.keys(filters).length === 0
              ? 'Inventory will appear here once stock levels are tracked.'
              : 'No inventory matches the current filters.'}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile card layout */}
          <div className="md:hidden space-y-3">
            {inventoryLevels.map((level) => {
              const available = level.quantity - level.reservedQuantity;
              const isLow = available <= 5;
              return (
                <div
                  key={level.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {level.variant?.product?.name || 'Unknown'}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {level.variant?.name || 'N/A'}{' '}
                        <span className="text-gray-400 font-mono text-xs">
                          ({level.variant?.sku || 'N/A'})
                        </span>
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {level.location?.name || 'Unknown'}
                        {level.location?.type ? ` · ${level.location.type}` : ''}
                      </p>
                    </div>
                    <StatusBadge available={available} isLow={isLow} />
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-sm">
                    <div>
                      <span className="text-gray-400 text-xs">Qty</span>
                      <p className="font-semibold text-gray-700">{level.quantity}</p>
                    </div>
                    <div>
                      <span className="text-gray-400 text-xs">Reserved</span>
                      <p className="font-semibold text-gray-700">{level.reservedQuantity}</p>
                    </div>
                    <div>
                      <span className="text-gray-400 text-xs">Available</span>
                      <p className={`font-semibold ${isLow ? 'text-red-600' : 'text-green-600'}`}>
                        {available}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-gray-100 flex justify-end">
                    <button
                      onClick={() => setAdjustTarget(level)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                    >
                      <SlidersHorizontal size={12} />
                      Adjust
                    </button>
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
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Variant</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Location</th>
                    <SortableHeader
                      label="Quantity"
                      column="quantity"
                      currentSortBy={sort.sortBy}
                      currentSortDir={sort.sortDir as 'ASC' | 'DESC' | undefined}
                      onSort={setSort}
                    />
                    <SortableHeader
                      label="Reserved"
                      column="reservedQuantity"
                      currentSortBy={sort.sortBy}
                      currentSortDir={sort.sortDir as 'ASC' | 'DESC' | undefined}
                      onSort={setSort}
                    />
                    <th className="px-4 py-3">Available</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {inventoryLevels.map((level) => {
                    const available = level.quantity - level.reservedQuantity;
                    const isLow = available <= 5;
                    return (
                      <tr key={level.id} className="hover:bg-blue-50/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {level.variant?.product?.name || 'Unknown'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {level.variant?.name || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                          {level.variant?.sku || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          <span>{level.location?.name || 'Unknown'}</span>
                          {level.location?.type && (
                            <span className="text-gray-400 text-xs ml-1">
                              ({level.location.type})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700 font-medium">{level.quantity}</td>
                        <td className="px-4 py-3 text-gray-500">{level.reservedQuantity}</td>
                        <td className="px-4 py-3">
                          <span className={`font-medium ${isLow ? 'text-red-600' : 'text-green-600'}`}>
                            {available}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge available={available} isLow={isLow} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setAdjustTarget(level)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                          >
                            <SlidersHorizontal size={12} />
                            Adjust
                          </button>
                        </td>
                      </tr>
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

      {/* Stock Adjust Dialog */}
      {adjustTarget && (
        <StockAdjustDialog
          level={adjustTarget as any}
          variant={{
            id: adjustTarget.variant?.id || '',
            name: adjustTarget.variant?.name || '',
            sku: adjustTarget.variant?.sku || '',
            productId: adjustTarget.variant?.product?.id || '',
          } as any}
          product={{
            id: adjustTarget.variant?.product?.id || '',
            name: adjustTarget.variant?.product?.name || '',
            lowStockThreshold: 5,
          } as any}
          onClose={() => setAdjustTarget(null)}
        />
      )}
    </div>
  );
}

function StatusBadge({ available, isLow }: { available: number; isLow: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        isLow
          ? 'bg-red-100 text-red-700'
          : 'bg-green-100 text-green-700'
      }`}
    >
      {isLow ? 'Low Stock' : 'In Stock'}
    </span>
  );
}
