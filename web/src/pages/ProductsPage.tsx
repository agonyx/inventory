import { useState, useMemo } from 'react';
import { Download } from 'lucide-react';
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
import useUrlFilters from '../hooks/useUrlFilters';
import ProductTable from '../components/ProductTable';
import ProductForm from '../components/ProductForm';
import StockAdjustDialog from '../components/StockAdjustDialog';
import FilterBar from '../components/FilterBar';
import Pagination from '../components/Pagination';
import ConfirmModal from '../components/ConfirmModal';

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
    </div>
  );
}
