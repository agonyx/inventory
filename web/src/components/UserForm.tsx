import { useState } from 'react';
import { X } from 'lucide-react';
import { useCreateUser, useUpdateUser, type UserItem } from '../hooks/useUsers';

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'warehouse', label: 'Warehouse' },
];

interface UserFormProps {
  user?: UserItem | null;
  onClose: () => void;
}

interface CreateFormData {
  email: string;
  password: string;
  name: string;
  role: string;
}

interface EditFormData {
  name: string;
  email: string;
  role: string;
}

const emptyCreate: CreateFormData = { email: '', password: '', name: '', role: 'warehouse' };
const emptyEdit = (u: UserItem): EditFormData => ({ name: u.name, email: u.email, role: u.role });

export default function UserForm({ user, onClose }: UserFormProps) {
  const isEdit = !!user;
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const [createData, setCreateData] = useState<CreateFormData>(emptyCreate);
  const [editData, setEditData] = useState<EditFormData>(user ? emptyEdit(user) : { name: '', email: '', role: 'warehouse' });
  const [error, setError] = useState<string | null>(null);

  const isPending = createUser.isPending || updateUser.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      if (isEdit && user) {
        await updateUser.mutateAsync({ id: user.id, ...editData });
      } else {
        if (!createData.password || createData.password.length < 6) {
          setError('Password must be at least 6 characters');
          return;
        }
        await createUser.mutateAsync(createData);
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save user');
    }
  };

  const data = isEdit ? editData : createData;
  const setField = (field: string, value: string) => {
    if (isEdit) {
      setEditData((prev) => ({ ...prev, [field]: value }));
    } else {
      setCreateData((prev) => ({ ...prev, [field]: value }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Edit User' : 'Create User'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={data.name}
              onChange={(e) => setField('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Full name"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={data.email}
              onChange={(e) => setField('email', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="user@example.com"
              required
            />
          </div>

          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={(createData as CreateFormData).password}
                onChange={(e) => setField('password', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Min. 6 characters"
                required
                minLength={6}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={data.role}
              onChange={(e) => setField('role', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

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
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition"
            >
              {isPending ? 'Saving...' : isEdit ? 'Update User' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
