import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { User as UserIcon, Users, Shield, Pencil, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../api/client';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser, useChangePassword, type UserItem } from '../hooks/useUsers';
import UserForm from '../components/UserForm';
import ConfirmModal from '../components/ConfirmModal';

const ROLE_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  admin: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Admin' },
  manager: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Manager' },
  warehouse: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Warehouse' },
};

function ProfileTab() {
  const { data: user } = useAuth();
  const queryClient = useQueryClient();
  const changePassword = useChangePassword();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setProfileErr(null);
    try {
      const updated = await apiFetch<{ id: string; email: string; name: string; role: string }>('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      queryClient.setQueryData(['auth', 'me'], updated);
      toast.success('Profile updated');
      setProfileMsg('Profile updated successfully.');
    } catch (err: unknown) {
      setProfileErr(err instanceof Error ? err.message : 'Failed to update profile');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    setPwErr(null);

    if (newPassword.length < 6) {
      setPwErr('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwErr('Passwords do not match');
      return;
    }

    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      toast.success('Password changed');
      setPwMsg('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setPwErr(err instanceof Error ? err.message : 'Failed to change password');
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile Information</h3>
        <form onSubmit={handleProfileSave} className="max-w-md space-y-4">
          {profileMsg && (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{profileMsg}</div>
          )}
          {profileErr && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{profileErr}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGES[user.role]?.bg || 'bg-gray-100'} ${ROLE_BADGES[user.role]?.text || 'text-gray-600'}`}>
                <Shield size={12} className="mr-1" />
                {ROLE_BADGES[user.role]?.label || user.role}
              </span>
            </div>
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
          >
            Save Changes
          </button>
        </form>
      </div>

      <div className="border-t border-gray-200 pt-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h3>
        <form onSubmit={handleChangePassword} className="max-w-md space-y-4">
          {pwMsg && (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{pwMsg}</div>
          )}
          {pwErr && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{pwErr}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              minLength={6}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              minLength={6}
            />
          </div>
          <button
            type="submit"
            disabled={changePassword.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition"
          >
            {changePassword.isPending ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

function UsersTab() {
  const { data: currentUser } = useAuth();
  const { data, isLoading } = useUsers({ page: '1', limit: '100' });
  const deleteUser = useDeleteUser();

  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);

  const users = data?.data ?? [];

  const openCreate = () => {
    setEditingUser(null);
    setShowForm(true);
  };

  const openEdit = (u: UserItem) => {
    setEditingUser(u);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteUser.mutateAsync(deleteTarget.id);
      toast.success('User deleted');
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete user');
      setDeleteTarget(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg border p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3" />
            <div className="h-3 bg-gray-100 rounded w-1/4 mt-2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{users.length} user{users.length !== 1 ? 's' : ''}</p>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={14} /> Add User
        </button>
      </div>

      {/* Mobile card layout */}
      <div className="md:hidden space-y-3">
        {users.map((u) => {
          const badge = ROLE_BADGES[u.role] || ROLE_BADGES.warehouse;
          const isSelf = u.id === currentUser?.id;
          return (
            <div key={u.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {u.name} {isSelf && <span className="text-xs text-gray-400">(you)</span>}
                  </p>
                  <p className="text-sm text-gray-500 truncate">{u.email}</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text} mt-1`}>
                    {badge.label}
                  </span>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button onClick={() => openEdit(u)} className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition">
                    <Pencil size={14} />
                  </button>
                  {!isSelf && (
                    <button onClick={() => setDeleteTarget(u)} className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Last Login</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => {
                const badge = ROLE_BADGES[u.role] || ROLE_BADGES.warehouse;
                const isSelf = u.id === currentUser?.id;
                return (
                  <tr key={u.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {u.name} {isSelf && <span className="text-xs text-gray-400">(you)</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                        <Shield size={10} className="mr-1" />
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : <span className="text-gray-300">&mdash;</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(u)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        {!isSelf && (
                          <button
                            onClick={() => setDeleteTarget(u)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition"
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <UserForm
          user={editingUser}
          onClose={() => {
            setShowForm(false);
            setEditingUser(null);
          }}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete User"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

type Tab = 'profile' | 'users';

export default function SettingsPage() {
  const { data: user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  const tabs: { key: Tab; label: string; icon: React.ReactNode; adminOnly: boolean }[] = [
    { key: 'profile', label: 'Profile', icon: <UserIcon size={16} />, adminOnly: false },
    { key: 'users', label: 'Users', icon: <Users size={16} />, adminOnly: true },
  ];

  const visibleTabs = tabs.filter((t) => !t.adminOnly || isAdmin);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Settings</h2>

      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div>
        {activeTab === 'profile' && <ProfileTab />}
        {activeTab === 'users' && isAdmin && <UsersTab />}
      </div>
    </div>
  );
}
