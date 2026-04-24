import { useState } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useWebhookConfigs, useCreateWebhook, useUpdateWebhook, useDeleteWebhook,
  WEBHOOK_EVENT_TYPES, type WebhookConfig,
} from '../hooks/useWebhookConfigs';
import ConfirmModal from '../components/ConfirmModal';

const EVENT_LABELS: Record<string, string> = {
  'order.created': 'Order Created',
  'order.status_changed': 'Order Status Changed',
  'stock.low': 'Low Stock Alert',
  'stock.adjusted': 'Stock Adjusted',
};

interface FormData {
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
}

const emptyForm: FormData = { url: '', events: [], secret: '', isActive: true };

export default function WebhookConfigsPage() {
  const { data: configs, isLoading } = useWebhookConfigs();
  const createMut = useCreateWebhook();
  const updateMut = useUpdateWebhook();
  const deleteMut = useDeleteWebhook();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<WebhookConfig | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<WebhookConfig | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (cfg: WebhookConfig) => {
    setEditing(cfg);
    setForm({ url: cfg.url, events: [...cfg.events], secret: cfg.secret ?? '', isActive: cfg.isActive });
    setShowForm(true);
  };

  const toggleEvent = (event: string) => {
    setForm((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.events.length === 0) {
      toast.error('Select at least one event');
      return;
    }

    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, ...form });
        toast.success('Webhook updated');
      } else {
        await createMut.mutateAsync(form);
        toast.success('Webhook created');
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditing(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save webhook');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync(deleteTarget.id);
      toast.success('Webhook deleted');
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  const toggleActive = async (cfg: WebhookConfig) => {
    try {
      await updateMut.mutateAsync({ id: cfg.id, isActive: !cfg.isActive });
      toast.success(`Webhook ${!cfg.isActive ? 'enabled' : 'disabled'}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-100 rounded w-1/2 mt-2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Outgoing Webhooks</h2>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          <Plus size={16} /> Add Webhook
        </button>
      </div>

      {/* Config list */}
      <div className="space-y-3">
        {(!configs || configs.length === 0) && (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
            No webhooks configured yet. Click "Add Webhook" to create one.
          </div>
        )}

        {configs?.map((cfg) => (
          <div key={cfg.id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${cfg.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <p className="font-mono text-sm text-gray-900 truncate">{cfg.url}</p>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {cfg.events.map((ev) => (
                    <span key={ev} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                      {EVENT_LABELS[ev] ?? ev}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Created {new Date(cfg.createdAt).toLocaleDateString()}
                  {cfg.secret ? ' · Secret configured' : ' · No secret'}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => toggleActive(cfg)} className="p-2 text-gray-400 hover:text-gray-600 transition" title={cfg.isActive ? 'Disable' : 'Enable'}>
                  {cfg.isActive ? <ToggleRight size={20} className="text-green-500" /> : <ToggleLeft size={20} />}
                </button>
                <button onClick={() => openEdit(cfg)} className="p-2 text-gray-400 hover:text-blue-600 transition" title="Edit">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => setDeleteTarget(cfg)} className="p-2 text-gray-400 hover:text-red-600 transition" title="Delete">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editing ? 'Edit Webhook' : 'New Webhook'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                <input
                  type="url"
                  value={form.url}
                  onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://example.com/webhook"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Events</label>
                <div className="space-y-2">
                  {WEBHOOK_EVENT_TYPES.map((ev) => (
                    <label key={ev} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.events.includes(ev)}
                        onChange={() => toggleEvent(ev)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      {EVENT_LABELS[ev] ?? ev}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Secret (optional)</label>
                <input
                  type="text"
                  value={form.secret}
                  onChange={(e) => setForm((prev) => ({ ...prev, secret: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="HMAC signing secret"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMut.isPending || updateMut.isPending}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {createMut.isPending || updateMut.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <ConfirmModal
          open={!!deleteTarget}
          title="Delete Webhook"
          message={`Delete webhook to ${deleteTarget.url}? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          variant="danger"
        />
      )}
    </div>
  );
}
