import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Truck, X } from 'lucide-react';
import { toast } from 'sonner';
import useUrlFilters from '../hooks/useUrlFilters';
import FilterBar from '../components/FilterBar';
import type { FilterConfig } from '../components/FilterBar';
import Pagination from '../components/Pagination';
import SkeletonTable from '../components/SkeletonTable';
import ConfirmModal from '../components/ConfirmModal';
import {
  useSuppliers,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  type Supplier,
} from '../hooks/useSuppliers';

const FILTER_CONFIG: FilterConfig[] = [
  { key: 'search', label: 'Search', type: 'search', placeholder: 'Search suppliers...' },
];

interface SupplierFormData {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
}

const EMPTY_FORM: SupplierFormData = { name: '', contactName: '', email: '', phone: '', address: '', notes: '' };

export default function SuppliersPage() {
  const { filters, page, limit, setFilter, setPage, setLimit, resetFilters } = useUrlFilters();

  const params: Record<string, string> = {
    ...filters,
    page: String(page),
    limit: String(limit),
  };

  const { data, isLoading } = useSuppliers(params);
  const suppliers = data?.data ?? [];
  const pagination = data?.pagination;

  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const deleteSupplier = useDeleteSupplier();

  const [formOpen, setFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierFormData>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  const isSaving = createSupplier.isPending || updateSupplier.isPending;

  const openCreateForm = () => {
    setEditingSupplier(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  };

  const openEditForm = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setForm({
      name: supplier.name,
      contactName: supplier.contactName || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      notes: supplier.notes || '',
    });
    setFormError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingSupplier(null);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.name.trim()) {
      setFormError('Name is required.');
      return;
    }

    const payload: Partial<Supplier> = {
      name: form.name.trim(),
      contactName: form.contactName.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      address: form.address.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };

    try {
      if (editingSupplier) {
        await updateSupplier.mutateAsync({ id: editingSupplier.id, ...payload });
        toast.success('Supplier updated successfully.');
      } else {
        await createSupplier.mutateAsync(payload);
        toast.success('Supplier created successfully.');
      }
      closeForm();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save supplier.');
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteSupplier.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success('Supplier deleted.');
        setDeleteTarget(null);
      },
      onError: (err: any) => {
        toast.error(err.message || 'Failed to delete supplier.');
        setDeleteTarget(null);
      },
    });
  };

  useEffect(() => {
    if (!formOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeForm();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [formOpen]);

  if (isLoading) {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Suppliers</h2>
        <SkeletonTable rows={5} columns={6} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-xl font-semibold">Suppliers</h2>
        <button
          onClick={openCreateForm}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={14} />
          Add Supplier
        </button>
      </div>

      <div className="mb-4">
        <FilterBar
          filters={FILTER_CONFIG}
          values={filters}
          onChange={setFilter}
          onReset={resetFilters}
        />
      </div>

      {!suppliers.length ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 py-16 text-center">
          <Truck className="mx-auto text-gray-300" size={48} />
          <p className="text-gray-500 mt-3">No suppliers found.</p>
          <p className="text-gray-400 text-sm mt-1">
            {Object.keys(filters).length === 0
              ? 'Create your first supplier to start managing vendor relationships.'
              : 'No suppliers match the current filters.'}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile card layout */}
          <div className="md:hidden space-y-3">
            {suppliers.map((s) => (
              <div key={s.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{s.name}</p>
                    {s.contactName && (
                      <p className="text-xs text-gray-500 mt-0.5">{s.contactName}</p>
                    )}
                    {s.email && (
                      <p className="text-xs text-blue-600 mt-0.5 truncate">{s.email}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => openEditForm(s)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(s)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                  {s.phone && <span>{s.phone}</span>}
                  <span>{s.productCount ?? 0} product{(s.productCount ?? 0) !== 1 ? 's' : ''}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3 text-center">Products</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {suppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {s.contactName || <span className="text-gray-300">&mdash;</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {s.email ? (
                          <a href={`mailto:${s.email}`} className="text-blue-600 hover:underline">{s.email}</a>
                        ) : (
                          <span className="text-gray-300">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {s.phone || <span className="text-gray-300">&mdash;</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {s.productCount ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditForm(s)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                          >
                            <Pencil size={12} />
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteTarget(s)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition"
                          >
                            <Trash2 size={12} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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

      {/* Supplier Form Overlay */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeForm} />
          <div className="relative bg-white rounded-none md:rounded-xl shadow-2xl w-full max-w-full md:max-w-lg mx-0 md:mx-4 min-h-screen md:min-h-0">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
              </h3>
              <button
                onClick={closeForm}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g. Acme Supplies"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                <input
                  type="text"
                  value={form.contactName}
                  onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g. Jane Doe"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="supplier@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+1 555-0123"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Street address, city, state, zip..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Internal notes about this supplier..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition"
                >
                  {isSaving
                    ? 'Saving...'
                    : editingSupplier
                      ? 'Update Supplier'
                      : 'Create Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Supplier"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
