import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Package, ClipboardList, AlertTriangle, FileText, Menu, X, LogOut, User } from 'lucide-react';
import { useAuth, useLogout } from '../hooks/useAuth';

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data: user } = useAuth();
  const logout = useLogout();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-blue-100 text-blue-700'
        : 'text-gray-600 hover:bg-gray-100'
    }`;

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 md:px-6 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Package size={20} className="text-blue-600" />
            Niche Inventory
          </h1>

          {/* Desktop nav */}
          <nav className="hidden md:flex gap-1">
            <NavLink to="/" className={linkClass} end>
              <Package size={16} /> Products
            </NavLink>
            <NavLink to="/orders" className={linkClass}>
              <ClipboardList size={16} /> Orders
            </NavLink>
            <NavLink to="/pick-list" className={linkClass}>
              <AlertTriangle size={16} /> Pick List
            </NavLink>
            <NavLink to="/audit-logs" className={linkClass}>
              <FileText size={16} /> Audit Logs
            </NavLink>
          </nav>

          {/* User info and logout */}
          {user && (
            <div className="hidden md:flex items-center gap-3 ml-4 pl-4 border-l border-gray-200">
              <span className="text-sm text-gray-600 flex items-center gap-1">
                <User size={14} /> {user.name}
              </span>
              <button
                onClick={() => logout.mutate()}
                className="text-sm text-gray-500 hover:text-red-600 flex items-center gap-1 transition"
              >
                <LogOut size={14} /> Logout
              </button>
            </div>
          )}

          {/* Mobile hamburger button */}
          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100 transition"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile nav dropdown */}
        {mobileMenuOpen && (
          <nav className="md:hidden mt-3 pt-3 border-t border-gray-100 flex flex-col gap-1 pb-1">
            <NavLink to="/" className={linkClass} end onClick={closeMobileMenu}>
              <Package size={16} /> Products
            </NavLink>
            <NavLink to="/orders" className={linkClass} onClick={closeMobileMenu}>
              <ClipboardList size={16} /> Orders
            </NavLink>
            <NavLink to="/pick-list" className={linkClass} onClick={closeMobileMenu}>
              <AlertTriangle size={16} /> Pick List
            </NavLink>
            <NavLink to="/audit-logs" className={linkClass} onClick={closeMobileMenu}>
              <FileText size={16} /> Audit Logs
            </NavLink>
          </nav>
        )}
      </header>
      <main className="p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}
