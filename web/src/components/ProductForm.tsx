import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type { Product, ProductVariant } from '../hooks/useProducts';
import { useCreateProduct, useUpdateProduct } from '../hooks/useProducts';

interface VariantRow {
  name: string;
  sku: string;
  description: string;
}

interface ProductFormProps {
  product?: Product | null;
  onClose: () => void;
}

export default function ProductForm({ product, onClose }: ProductFormProps) {
  const isEdit = !!product;

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [variants, setVariants] = useState<VariantRow[]>([
    { name: '', sku: '', description: '' },
  ]);
  const [error, setError] = useState<string | null>(null);

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  useEffect(() => {
    if (product) {
      setName(product.name);
      setSku(product.sku);
      setCategory(product.category || '');
      setDescription(product.description || '');
      setPrice(product.price.toString());
      setLowStockThreshold(product.lowStockThreshold.toString());
      if (product.variants.length) {
        setVariants(
          product.variants.map((v) => ({
            name: v.name,
            sku: v.sku,
            description: v.description || '',
          })),
        );
      }
    }
  }, [product]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const addVariantRow = () => {
    setVariants((prev) => [...prev, { name: '', sku: '', description: '' }]);
  };

  const removeVariantRow = (index: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const updateVariant = (
    index: number,
    field: keyof VariantRow,
    value: string,
  ) => {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !sku.trim()) {
      setError('Name and SKU are required.');
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      setError('Please enter a valid price.');
      return;
    }

    const thresholdNum = parseInt(lowStockThreshold, 10);
    if (isNaN(thresholdNum) || thresholdNum < 0) {
      setError('Please enter a valid low stock threshold.');
      return;
    }

    const payload = {
      name: name.trim(),
      sku: sku.trim(),
      category: category.trim() || null,
      description: description.trim() || null,
      price: priceNum,
      lowStockThreshold: thresholdNum,
      variants: variants
        .filter((v) => v.name.trim() && v.sku.trim())
        .map((v) => ({
          name: v.name.trim(),
          sku: v.sku.trim(),
          description: v.description.trim() || null,
        })),
    };

    try {
      if (isEdit && product) {
        const { variants: _v, ...productFields } = payload;
        await updateProduct.mutateAsync({ id: product.id, ...productFields });
      } else {
        await createProduct.mutateAsync(payload as any);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    }
  };

  const isSubmitting = createProduct.isPending || updateProduct.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Edit Product' : 'New Product'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g. Widget Pro"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SKU <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                placeholder="e.g. WDG-001"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g. Electronics"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price ($) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Optional product description..."
            />
          </div>

          <div className="w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Low Stock Threshold
            </label>
            <input
              type="number"
              min="0"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Variants Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Variants
              </label>
              <button
                type="button"
                onClick={addVariantRow}
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <Plus size={14} /> Add Variant
              </button>
            </div>

            {variants.length === 0 ? (
              <p className="text-gray-400 text-sm italic">
                No variants added. Click "Add Variant" to add one.
              </p>
            ) : (
              <div className="space-y-2">
                {variants.map((variant, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={variant.name}
                        onChange={(e) =>
                          updateVariant(idx, 'name', e.target.value)
                        }
                        className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Variant name"
                      />
                      <input
                        type="text"
                        value={variant.sku}
                        onChange={(e) =>
                          updateVariant(idx, 'sku', e.target.value)
                        }
                        className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                        placeholder="SKU"
                      />
                    </div>
                    <input
                      type="text"
                      value={variant.description}
                      onChange={(e) =>
                        updateVariant(idx, 'description', e.target.value)
                      }
                      className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Description (optional)"
                    />
                    <button
                      type="button"
                      onClick={() => removeVariantRow(idx)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition mt-0.5"
                      title="Remove variant"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition"
            >
              {isSubmitting ? 'Saving...' : isEdit ? 'Update Product' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
