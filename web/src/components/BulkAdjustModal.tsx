import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useBulkAdjustInventory } from '../hooks/useBulkOperations';
import type { InventoryLevel } from '../hooks/useInventory';

const REASONS = [
  { value: 'received', label: 'Received' },
  { value: 'manual', label: 'Manual Adjustment' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'shrinkage', label: 'Shrinkage' },
  { value: 'return', label: 'Return' },
  { value: 'correction', label: 'Correction' },
];

interface BulkAdjustModalProps {
  levels: InventoryLevel[];
  onClose: () => void;
}

export default function BulkAdjustModal({ levels, onClose }: BulkAdjustModalProps) {
  const [quantityChange, setQuantityChange] = useState('');
  const [reason, setReason] = useState('received');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const bulkAdjust = useBulkAdjustInventory();

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

    const adjustments = levels.map((level) => ({
      inventoryLevelId: level.id,
      quantityChange: change,
      reason,
      note: note.trim() || undefined,
    }));

    try {
      const result = await bulkAdjust.mutateAsync(adjustments);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to adjust stock.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm md:backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-none md:rounded-xl shadow-2xl w-full max-w-full md:max-w-md mx-0 md:mx-4 min-h-screen md:min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">
            Bulk Adjust Stock
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Context info */}
        <div className="px-6 pt-4 pb-2">
          <p className="text-sm text-gray-700">
            Adjusting stock for <span className="font-semibold">{levels.length}</span> inventory level(s).
          </p>
          <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
            {levels.map((level) => (
              <p key={level.id} className="text-xs text-gray-500 truncate">
                {level.variant?.product?.name || 'Unknown'} &gt;{' '}
                {level.variant?.name || 'N/A'} @{' '}
                {level.location?.name || 'Unknown'}
                <span className="text-gray-400 ml-1">
                  (qty: {level.quantity})
                </span>
              </p>
            ))}
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
                (applied to all selected)
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
              Note
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Optional note for all adjustments..."
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
              disabled={bulkAdjust.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition"
            >
              {bulkAdjust.isPending ? 'Adjusting...' : `Adjust ${levels.length} Level(s)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
