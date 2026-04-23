import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useAdjustStock } from '../hooks/useInventory';
import type { InventoryLevel, ProductVariant, Product } from '../hooks/useProducts';

interface StockAdjustDialogProps {
  level: InventoryLevel;
  variant: ProductVariant;
  product: Product;
  onClose: () => void;
}

const REASONS = [
  { value: 'received', label: 'Received' },
  { value: 'manual', label: 'Manual Adjustment' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'shrinkage', label: 'Shrinkage' },
  { value: 'return', label: 'Return' },
  { value: 'correction', label: 'Correction' },
];

export default function StockAdjustDialog({
  level,
  variant,
  product,
  onClose,
}: StockAdjustDialogProps) {
  const [quantityChange, setQuantityChange] = useState('');
  const [reason, setReason] = useState('received');
  const [notes, setNotes] = useState('');
  const [adjustedBy, setAdjustedBy] = useState('');
  const [error, setError] = useState<string | null>(null);

  const adjustStock = useAdjustStock();

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const change = parseInt(quantityChange, 10);
    if (isNaN(change) || change === 0) {
      setError('Enter a non-zero quantity change.');
      return;
    }

    try {
      await adjustStock.mutateAsync({
        id: level.id,
        quantityChange: change,
        reason,
        notes: notes.trim() || undefined,
        adjustedBy: adjustedBy.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to adjust stock.');
    }
  };

  const currentAvailable = level.quantity - level.reservedQuantity;
  const projectedAvailable = currentAvailable + (parseInt(quantityChange, 10) || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">
            Adjust Stock
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Context info */}
        <div className="px-6 pt-4 pb-2 space-y-1">
          <p className="text-sm text-gray-700">
            <span className="font-medium">Product:</span> {product.name}
          </p>
          <p className="text-sm text-gray-700">
            <span className="font-medium">Variant:</span> {variant.name}{' '}
            <span className="text-gray-400 font-mono text-xs">({variant.sku})</span>
          </p>
          <p className="text-sm text-gray-700">
            <span className="font-medium">Location:</span>{' '}
            {level.location?.name || 'Unknown'}
          </p>
          <div className="flex gap-6 mt-2 text-sm">
            <div>
              <span className="text-gray-500">On Hand:</span>{' '}
              <span className="font-semibold">{level.quantity}</span>
            </div>
            <div>
              <span className="text-gray-500">Reserved:</span>{' '}
              <span className="font-semibold">{level.reservedQuantity}</span>
            </div>
            <div>
              <span className="text-gray-500">Available:</span>{' '}
              <span
                className={`font-semibold ${
                  currentAvailable <= product.lowStockThreshold
                    ? 'text-red-600'
                    : 'text-green-600'
                }`}
              >
                {currentAvailable}
              </span>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity Change{' '}
              <span className="text-gray-400 font-normal">
                (positive to add, negative to remove)
              </span>
            </label>
            <input
              type="number"
              value={quantityChange}
              onChange={(e) => setQuantityChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g. 10 or -5"
              autoFocus
            />
          </div>

          {quantityChange && parseInt(quantityChange, 10) !== 0 && (
            <div className="text-sm p-2 bg-gray-50 rounded-lg">
              <span className="text-gray-500">Projected available:</span>{' '}
              <span
                className={`font-semibold ${
                  projectedAvailable <= product.lowStockThreshold
                    ? 'text-red-600'
                    : 'text-green-600'
                }`}
              >
                {projectedAvailable}
              </span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Optional notes about this adjustment..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Adjusted By
            </label>
            <input
              type="text"
              value={adjustedBy}
              onChange={(e) => setAdjustedBy(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Your name (optional)"
            />
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
              disabled={adjustStock.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition"
            >
              {adjustStock.isPending ? 'Saving...' : 'Confirm Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
