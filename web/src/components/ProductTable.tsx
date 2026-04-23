import { useState, Fragment } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  ArrowUpDown,
  Loader2,
} from 'lucide-react';
import type {
  Product,
  ProductVariant,
  InventoryLevel,
} from '../hooks/useProducts';

interface ProductTableProps {
  products: Product[];
  isLoading: boolean;
  onAdd: () => void;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onAdjustStock: (level: InventoryLevel, variant: ProductVariant, product: Product) => void;
}

function totalStock(product: Product): number {
  return product.variants.reduce(
    (sum, v) =>
      sum +
      v.inventoryLevels.reduce(
        (s, lvl) => s + lvl.quantity - lvl.reservedQuantity,
        0,
      ),
    0,
  );
}

function hasLowStock(product: Product): boolean {
  for (const v of product.variants) {
    for (const lvl of v.inventoryLevels) {
      if (lvl.quantity - lvl.reservedQuantity <= product.lowStockThreshold) {
        return true;
      }
    }
  }
  return false;
}

export default function ProductTable({
  products,
  isLoading,
  onAdd,
  onEdit,
  onDelete,
  onAdjustStock,
}: ProductTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-blue-500" size={28} />
        <span className="ml-2 text-gray-500">Loading products...</span>
      </div>
    );
  }

  if (!products.length) {
    return (
      <div className="text-center py-20">
        <Package className="mx-auto text-gray-300" size={48} />
        <p className="text-gray-500 mt-3">No products yet.</p>
        <button
          onClick={onAdd}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={16} /> Add Product
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">Products</h2>
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={16} /> Add Product
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="w-8 px-4 py-3" />
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Stock</th>
              <th className="px-4 py-3 text-center">Variants</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.map((product) => {
              const isExpanded = expandedId === product.id;
              const stock = totalStock(product);
              const low = hasLowStock(product);

              return (
                <Fragment key={product.id}>
                  {/* Product row */}
                  <tr
                    className={`hover:bg-blue-50/50 transition-colors cursor-pointer ${
                      isExpanded ? 'bg-blue-50/30' : ''
                    }`}
                    onClick={() => toggleExpand(product.id)}
                  >
                    <td className="px-4 py-3 text-gray-400">
                      {isExpanded ? (
                        <ChevronDown size={16} />
                      ) : (
                        <ChevronRight size={16} />
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {product.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                      {product.sku}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {product.category || <span className="text-gray-300">&mdash;</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      ${product.price.toFixed(2)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        low ? 'text-red-600' : 'text-gray-900'
                      }`}
                    >
                      {stock}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500">
                      {product.variants.length}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {low ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          <AlertTriangle size={12} /> Low Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          In Stock
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(product);
                          }}
                          className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (
                              window.confirm(
                                `Delete "${product.name}"? This cannot be undone.`,
                              )
                            ) {
                              onDelete(product.id);
                            }
                          }}
                          className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded variants */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={9} className="p-0">
                        <div className="bg-gray-50/80 px-12 py-4">
                          {!product.variants.length ? (
                            <p className="text-gray-400 text-sm italic">
                              No variants.
                            </p>
                          ) : (
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                  <th className="pb-2 pr-4">Variant</th>
                                  <th className="pb-2 pr-4">SKU</th>
                                  <th className="pb-2 pr-4">Location</th>
                                  <th className="pb-2 pr-4 text-right">
                                    On Hand
                                  </th>
                                  <th className="pb-2 pr-4 text-right">
                                    Reserved
                                  </th>
                                  <th className="pb-2 pr-4 text-right">
                                    Available
                                  </th>
                                  <th className="pb-2 text-right">
                                    Status
                                  </th>
                                  <th className="pb-2 pl-4 text-right" />
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {product.variants.map((variant) =>
                                  variant.inventoryLevels.length === 0 ? (
                                    <tr key={variant.id}>
                                      <td
                                        colSpan={8}
                                        className="py-2 text-gray-400 text-xs italic"
                                      >
                                        {variant.name} ({variant.sku}) &mdash;
                                        no inventory recorded
                                      </td>
                                    </tr>
                                  ) : (
                                    variant.inventoryLevels.map((lvl) => {
                                      const available =
                                        lvl.quantity - lvl.reservedQuantity;
                                      const isLow =
                                        available <=
                                        product.lowStockThreshold;
                                      return (
                                        <tr
                                          key={lvl.id}
                                          className="hover:bg-white transition-colors"
                                        >
                                          <td className="py-2 pr-4 text-gray-700 font-medium">
                                            {variant.name}
                                          </td>
                                          <td className="py-2 pr-4 text-gray-500 font-mono text-xs">
                                            {variant.sku}
                                          </td>
                                          <td className="py-2 pr-4 text-gray-500">
                                            {lvl.location?.name || 'Unknown'}
                                          </td>
                                          <td className="py-2 pr-4 text-right text-gray-700">
                                            {lvl.quantity}
                                          </td>
                                          <td className="py-2 pr-4 text-right text-gray-500">
                                            {lvl.reservedQuantity}
                                          </td>
                                          <td
                                            className={`py-2 pr-4 text-right font-semibold ${
                                              isLow
                                                ? 'text-red-600'
                                                : 'text-gray-900'
                                            }`}
                                          >
                                            {available}
                                          </td>
                                          <td className="py-2 text-right">
                                            {isLow ? (
                                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                                                <AlertTriangle size={10} /> Low
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                                                OK
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-2 pl-4 text-right">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onAdjustStock(
                                                  lvl,
                                                  variant,
                                                  product,
                                                );
                                              }}
                                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100 rounded transition"
                                              title="Adjust Stock"
                                            >
                                              <ArrowUpDown size={12} /> Adjust
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })
                                  )
                                )}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Re-export Package since it's used in the empty state
function Package({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}
