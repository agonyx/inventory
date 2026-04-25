import { useState, useMemo, useEffect, useRef } from 'react';
import { Download, Trash2, X, ScanBarcode } from 'lucide-react';
import { toast } from 'sonner';
import {
  useProducts,
  useDeleteProduct,
  useCreateProduct,
  useUpdateProduct,
  type Product,
  type ProductVariant,
  type InventoryLevel,
} from '../hooks/useProducts';
import { useBulkDeleteProducts } from '../hooks/useBulkOperations';
import useUrlFilters from '../hooks/useUrlFilters';
import ProductTable from '../components/ProductTable';
import ProductForm from '../components/ProductForm';
import StockAdjustDialog from '../components/StockAdjustDialog';
import FilterBar from '../components/FilterBar';
import Pagination from '../components/Pagination';
import ConfirmModal from '../components/ConfirmModal';
import BarcodeScanner from '../components/BarcodeScanner';

const filterConfigs = [
  {
    key: 'search',
    label: 'Search',
    type: 'search' as const,
    placeholder: 'Search products...',
  },
  {
    key: 'category',
    label: 'Category',
    type: 'select' as const,
    options: [
      { value: 'Electronics', label: 'Electronics' },
      { value: 'Clothing', label: 'Clothing' },
      { value: 'Home', label: 'Home' },
      { value: 'Toys', label: 'Toys' },
      { value: 'Other', label: 'Other' },
    ],
  },
  {
    key: 'stockStatus',
    label: 'Stock Status',
    type: 'select' as const,
    options: [
      { value: 'in_stock', label: 'In Stock' },
      { value: 'low_stock', label: 'Low Stock' },
      { value: 'out_of_stock', label: 'Out of Stock' },
    ],
  },
];

export default function ProductsPage() {
  const {
    filters,
    sort: { sortBy, sortDir },
    page,
    limit,
    setFilter,
    setSort,
    setPage,
    setLimit,
    resetFilters,
  } = useUrlFilters();

  const params = useMemo(() => {
    const p: Record<string, string> = { ...filters };
    if (sortBy) {
      p.sortBy = sortBy;
      p.sortDir = sortDir;
    }
    if (page > 1) p.page = String(page);
    if (limit !== 25) p.limit = String(limit);
    return p;
  }, [filters, sortBy, sortDir, page, limit]);

  const { data, isLoading } = useProducts(params);
  const deleteProduct = useDeleteProduct();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const bulkDelete = useBulkDeleteProducts();

  const products = data?.data || [];
  const pagination = data?.pagination;

  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [stockAdjustTarget, setStockAdjustTarget] = useState<{
    level: InventoryLevel;
    variant: ProductVariant;
    product: Product;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Barcode search (local state, pushed as a URL filter param)
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [barcodeInput, setBarcodeInput] = useState(filters.barcode || '');
  const [scannerOpen, setScannerOpen] = useState(false);

  // Sync barcode input when filters.barcode changes externally (e.g. reset)
  useEffect(() => {
    setBarcodeInput(filters.barcode || '');
  }, [filters.barcode]);

  const handleBarcodeSearch = (value: string) => {
    const trimmed = value.trim();
    setFilter('barcode', trimmed);
  };

  const handleCameraScan = (code: string) => {
    setScannerOpen(false);
    setBarcodeInput(code);
    handleBarcodeSearch(code);
  };

  // Clear selection when products change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [products]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
  };

  const allSelected = products.length > 0 && selectedIds.size === products.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const handleBulkDelete = () => {
    bulkDelete.mutate(Array.from(selectedIds), {
      onSuccess: (data: { deleted: number }) => {
        toast.success(`${data.deleted} product(s) deleted`);
        setSelectedIds(new Set());
      },
      onError: (err: any) => {
        toast.error(err.message || 'Failed to delete products');
      },
    });
  };

  const handleAdd = () => {
    setEditingProduct(null);
    setFormOpen(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditingProduct(null);
  };

  const handleRequestDelete = (product: Product) => {
    setDeleteTarget(product);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteProduct.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success(`"${deleteTarget.name}" deleted`);
        setDeleteTarget(null);
      },
    });
  };

  const handleFormSuccess = (isEdit: boolean) => {
    toast.success(isEdit ? 'Product updated' : 'Product created');
    setFormOpen(false);
    setEditingProduct(null);
  };

  const handleAdjustStock = (
    level: InventoryLevel,
    variant: ProductVariant,
    product: Product,
  ) => {
    setStockAdjustTarget({ level, variant, product });
  };

  const handleExport = () => {
    const qs = new URLSearchParams(params).toString();
    window.open('/api/products/export' + (qs ? '?' + qs : ''));
  };

  const exportParams = useMemo(() => {
    const qs = new URLSearchParams(params).toString();
    return qs ? '?' + qs : '';
  }, [params]);

  return (
    <div className="space-y-4">
      {/* Barcode Search — prominent, scanner-friendly input */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <ScanBarcode
            size={16}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-500"
          />
          <input
            ref={barcodeInputRef}
            type="text"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleBarcodeSearch(barcodeInput);
              }
            }}
            onBlur={() => {
              // Only trigger if different from current filter
              const trimmed = barcodeInput.trim();
              if (trimmed !== (filters.barcode || '')) {
                handleBarcodeSearch(barcodeInput);
              }
            }}
            placeholder="Scan or type barcode..."
            className="w-full pl-9 pr-10 py-2 text-sm border-2 border-blue-200 rounded-lg bg-blue-50/50 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
          />
          <button
            onClick={() => setScannerOpen(true)}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-blue-400 hover:text-blue-600 hover:bg-blue-100 transition"
            title="Scan with camera"
          >
            <ScanBarcode size={16} />
          </button>
        </div>
        {filters.barcode && (
          <button
            onClick={() => {
              setBarcodeInput('');
              setFilter('barcode', '');
              barcodeInputRef.current?.focus();
            }}
            className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
            title="Clear barcode filter"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3">
        <FilterBar
          filters={filterConfigs}
          values={filters}
          onChange={setFilter}
          onReset={resetFilters}
        />
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition flex-shrink-0"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      <ProductTable
        products={products}
        isLoading={isLoading}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleRequestDelete}
        onAdjustStock={handleAdjustStock}
        sortBy={sortBy}
        sortDir={sortDir as 'ASC' | 'DESC' | undefined}
        onSort={setSort}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        allSelected={allSelected}
        someSelected={someSelected}
      />

      {/* Pagination */}
      {pagination && pagination.totalPages > 0 && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={pagination.limit}
          onPageChange={setPage}
          onLimitChange={setLimit}
        />
      )}

      {/* Product Form Modal */}
      {formOpen && (
        <ProductForm
          product={editingProduct}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* Stock Adjust Dialog */}
      {stockAdjustTarget && (
        <StockAdjustDialog
          level={stockAdjustTarget.level}
          variant={stockAdjustTarget.variant}
          product={stockAdjustTarget.product}
          onClose={() => setStockAdjustTarget(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmModal
        open={selectedIds.size > 0 && !deleteTarget}
        title="Delete Selected Products"
        message={`Are you sure you want to delete ${selectedIds.size} selected product(s)? This action cannot be undone.`}
        confirmLabel={`Delete ${selectedIds.size} Product(s)`}
        variant="danger"
        onConfirm={handleBulkDelete}
        onCancel={() => setSelectedIds(new Set())}
      />

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
          <button
            onClick={handleBulkDelete}
            disabled={bulkDelete.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition"
          >
            <Trash2 size={14} />
            {bulkDelete.isPending ? 'Deleting...' : 'Delete Selected'}
          </button>
        </div>
      )}

      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleCameraScan} />
    </div>
  );
}
