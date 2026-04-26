import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, MapPin, X } from 'lucide-react';
import { toast } from 'sonner';
import useUrlFilters from '../hooks/useUrlFilters';
import FilterBar from '../components/FilterBar';
import type { FilterConfig } from '../components/FilterBar';
import Pagination from '../components/Pagination';
import SkeletonTable from '../components/SkeletonTable';
import ConfirmModal from '../components/ConfirmModal';
import {
  useLocations,
  useCreateLocation,
  useUpdateLocation,
  useDeleteLocation,
  type Location,
} from '../hooks/useLocations';

const FILTER_CONFIG: FilterConfig[] = [
  { key: 'search', label: 'Search', type: 'search', placeholder: 'Search locations...' },
];

interface LocationFormData {
  name: string;
  type: string;
  address: string;
}

function formatLocationType(type: string | null | undefined): string {
  if (!type) return 'Unknown';
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

const EMPTY_FORM: LocationFormData = { name: '', type: '', address: '' };

export default function LocationsPage() {
  const { filters, page, limit, setFilter, setPage, setLimit, resetFilters } = useUrlFilters();

  const params: Record<string, string> = {
    ...filters,
    page: String(page),
    limit: String(limit),
  };

  const { data, isLoading } = useLocations(params);
  const locations = data?.data ?? [];
  const pagination = data?.pagination;

  const createLocation = useCreateLocation();
  const updateLocation = useUpdateLocation();
  const deleteLocation = useDeleteLocation();

  // Form overlay state
  const [formOpen, setFormOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [form, setForm] = useState<LocationFormData>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Location | null>(null);

  const isSaving = createLocation.isPending || updateLocation.isPending;

  const openCreateForm = () => {
    setEditingLocation(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  };

  const openEditForm = (location: Location) => {
    setEditingLocation(location);
    setForm({
      name: location.name,
      type: location.type || '',
      address: location.address || '',
    });
    setFormError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingLocation(null);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.name.trim()) {
      setFormError('Name is required.');
      return;
    }

    const payload: Partial<Location> = {
      name: form.name.trim(),
      type: form.type.trim() || null,
      address: form.address.trim() || null,
    };

    try {
      if (editingLocation) {
        await updateLocation.mutateAsync({ id: editingLocation.id, ...payload });
        toast.success('Location updated successfully.');
      } else {
        await createLocation.mutateAsync(payload);
        toast.success('Location created successfully.');
      }
      closeForm();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save location.');
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteLocation.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success('Location deleted.');
        setDeleteTarget(null);
      },
      onError: (err: any) => {
        toast.error(err.message || 'Failed to delete location.');
        setDeleteTarget(null);
      },
    });
  };

  // Escape key for form
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
        <h2 className="text-xl font-semibold mb-4">Locations</h2>
        <SkeletonTable rows={5} columns={5} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-xl font-semibold">Locations</h2>
        <button
          onClick={openCreateForm}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={14} />
          Add Location
        </button>
      </div>

      {/* FilterBar */}
      <div className="mb-4">
        <FilterBar
          filters={FILTER_CONFIG}
          values={filters}
          onChange={setFilter}
          onReset={resetFilters}
        />
      </div>

      {/* Content */}
      {!locations.length ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 py-16 text-center">
          <MapPin className="mx-auto text-gray-300" size={48} />
          <p className="text-gray-500 mt-3">No locations found.</p>
          <p className="text-gray-400 text-sm mt-1">
            {Object.keys(filters).length === 0
              ? 'Create your first location to start tracking inventory.'
              : 'No locations match the current filters.'}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile card layout */}
          <div className="md:hidden space-y-3">
            {locations.map((loc) => (
              <div
                key={loc.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{loc.name}</p>
                    {loc.type && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 mt-1">
                        {formatLocationType(loc.type)}
                      </span>
                    )}
                    {loc.address && (
                      <p className="text-xs text-gray-400 mt-1 truncate">{loc.address}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => openEditForm(loc)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(loc)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-400">
                  {loc.variantCount ?? 0} variant{Number(loc.variantCount ?? 0) !== 1 ? 's' : ''}
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
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Address</th>
                    <th className="px-4 py-3 text-center">Variants</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {locations.map((loc) => (
                    <tr key={loc.id} className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{loc.name}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {loc.type ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                            {formatLocationType(loc.type)}
                          </span>
                        ) : (
                          <span className="text-gray-300">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-xs truncate">
                        {loc.address || <span className="text-gray-300">&mdash;</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {loc.variantCount ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditForm(loc)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                          >
                            <Pencil size={12} />
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteTarget(loc)}
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

      {/* Location Form Overlay */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeForm} />
          <div className="relative bg-white rounded-none md:rounded-xl shadow-2xl w-full max-w-full md:max-w-lg mx-0 md:mx-4 min-h-screen md:min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingLocation ? 'Edit Location' : 'Add Location'}
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
                  placeholder="e.g. Main Warehouse"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="">Select type...</option>
                  <option value="warehouse">Warehouse</option>
                  <option value="cold_storage">Cold Storage</option>
                  <option value="store">Store</option>
                  <option value="supplier">Supplier</option>
                  <option value="virtual">Virtual</option>
                  <option value="other">Other</option>
                </select>
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
                    : editingLocation
                      ? 'Update Location'
                      : 'Create Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Location"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
