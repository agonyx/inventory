import { NavLink, Outlet } from 'react-router-dom';
import { Package, ClipboardList, AlertTriangle } from 'lucide-react';

export default function Layout() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-blue-100 text-blue-700'
        : 'text-gray-600 hover:bg-gray-100'
    }`;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Package size={20} className="text-blue-600" />
            Niche Inventory
          </h1>
          <nav className="flex gap-1">
            <NavLink to="/" className={linkClass}>
              <Package size={16} /> Products
            </NavLink>
            <NavLink to="/orders" className={linkClass}>
              <ClipboardList size={16} /> Orders
            </NavLink>
            <NavLink to="/pick-list" className={linkClass}>
              <AlertTriangle size={16} /> Pick List
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
