import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useLocations } from '../hooks/useLocations';
import { useProducts } from '../hooks/useProducts';
import { useCreateTransfer } from '../hooks/useTransfers';
import { toast } from 'sonner';

interface TransferFormProps {
  open: boolean;
  onClose: () => void;
}

interface ItemRow {
  variantId: string;
  quantity: number;
}

export default function TransferForm({ open, onClose }: TransferFormProps) {
  const [fromLocationId, setFromLocationId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [notes, setNotes] = useState('');
  const [itemRows, setItemRows] = useState<ItemRow[]>([{ variantId: '', quantity: 1 }]);

  const { data: locationsData } = useLocations({ limit: '100' });
  const locations = locationsData?.data ?? [];

  const { data: productsData } = useProducts({ limit: '100' });
  const products = productsData?.data ?? [];

  // Flatten all variants from all products for the selector
  const allVariants = products.flatMap((p) =>
    (p.variants || []).map((v) => ({
      id: v.id,
      name: v.name,
      sku: v.sku,
      productName: p.name,
      inventoryLevels: v.inventoryLevels || [],
    })),
  );

  const createTransfer = useCreateTransfer();

  const addItemRow = () => {
    setItemRows([...itemRows, { variantId: '', quantity: 1 }]);
  };

  const removeItemRow = (index: number) => {
    setItemRows(itemRows.filter((_, i) => i !== index));
  };

  const updateItemRow = (index: number, field: keyof ItemRow, value: string | number) => {
    const updated = [...itemRows];
    updated[index] = { ...updated[index], [field]: value };
    setItemRows(updated);
  };

  const getAvailableStock = (variantId: string): number => {
    if (!fromLocationId) return 0;
    const variant = allVariants.find((v) => v.id === variantId);
    if (!variant) return 0;
    const level = variant.inventoryLevels.find((l) => l.locationId === fromLocationId);
    return level ? level.quantity - level.reservedQuantity : 0;
  };

  const handleSubmit = () => {
    if (!fromLocationId || !toLocationId) {
      toast.error('Please select both source and destination locations');
      return;
    }
    if (fromLocationId === toLocationId) {
      toast.error('Source and destination locations must be different');
      return;
    }
    const validItems = itemRows.filter((r) => r.variantId && r.quantity > 0);
    if (validItems.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    createTransfer.mutate(
      {
        fromLocationId,
        toLocationId,
        notes: notes || undefined,
        items: validItems.map((r) => ({ variantId: r.variantId, quantity: r.quantity })),
      },
      {
        onSuccess: () => {
          toast.success('Transfer created successfully');
          onClose();
          // Reset form
          setFromLocationId('');
          setToLocationId('');
          setNotes('');
          setItemRows([{ variantId: '', quantity: 1 }]);
        },
        onError: (err: unknown) => {
          toast.error(err instanceof Error ? err.message : 'Failed to create transfer');
        },
      },
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">New Stock Transfer</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 transition">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Locations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Location</label>
              <select
                value={fromLocationId}
                onChange={(e) => setFromLocationId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select source...</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Location</label>
              <select
                value={toLocationId}
                onChange={(e) => setToLocationId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select destination...</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional notes..."
            />
          </div>

          {/* Items */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Items</label>
            <div className="space-y-2">
              {itemRows.map((row, index) => {
                const available = getAvailableStock(row.variantId);
                const hasEnough = available >= row.quantity;
                return (
                  <div key={index} className="flex items-center gap-2">
                    <select
                      value={row.variantId}
                      onChange={(e) => updateItemRow(index, 'variantId', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select variant...</option>
                      {allVariants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.productName} — {v.name} ({v.sku})
                        </option>
                      ))}
                    </select>
                    <div className="relative w-24">
                      <input
                        type="number"
                        min={1}
                        value={row.quantity}
                        onChange={(e) => updateItemRow(index, 'quantity', parseInt(e.target.value) || 0)}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          row.variantId && !hasEnough ? 'border-red-300' : 'border-gray-200'
                        }`}
                      />
                      {row.variantId && (
                        <span className={`absolute -bottom-4 left-0 text-[10px] ${hasEnough ? 'text-gray-400' : 'text-red-500'}`}>
                          Avail: {available}
                        </span>
                      )}
                    </div>
                    {itemRows.length > 1 && (
                      <button
                        onClick={() => removeItemRow(index)}
                        className="p-2 text-gray-400 hover:text-red-500 transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              onClick={addItemRow}
              className="mt-6 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus size={16} /> Add Item
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createTransfer.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {createTransfer.isPending ? 'Creating...' : 'Create Transfer'}
          </button>
        </div>
      </div>
    </div>
  );
}
