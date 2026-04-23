import { useState } from 'react';
import {
  useProducts,
  useDeleteProduct,
  type Product,
  type ProductVariant,
  type InventoryLevel,
} from '../hooks/useProducts';
import ProductTable from '../components/ProductTable';
import ProductForm from '../components/ProductForm';
import StockAdjustDialog from '../components/StockAdjustDialog';

export default function ProductsPage() {
  const { data: products, isLoading } = useProducts();
  const deleteProduct = useDeleteProduct();

  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [stockAdjustTarget, setStockAdjustTarget] = useState<{
    level: InventoryLevel;
    variant: ProductVariant;
    product: Product;
  } | null>(null);

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

  const handleDelete = (id: string) => {
    deleteProduct.mutate(id);
  };

  const handleAdjustStock = (
    level: InventoryLevel,
    variant: ProductVariant,
    product: Product,
  ) => {
    setStockAdjustTarget({ level, variant, product });
  };

  return (
    <div className="space-y-6">
      <ProductTable
        products={products || []}
        isLoading={isLoading}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onAdjustStock={handleAdjustStock}
      />

      {formOpen && (
        <ProductForm product={editingProduct} onClose={handleFormClose} />
      )}

      {stockAdjustTarget && (
        <StockAdjustDialog
          level={stockAdjustTarget.level}
          variant={stockAdjustTarget.variant}
          product={stockAdjustTarget.product}
          onClose={() => setStockAdjustTarget(null)}
        />
      )}
    </div>
  );
}
