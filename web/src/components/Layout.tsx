import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Package, ClipboardList, AlertTriangle, FileText, MapPin, Warehouse, ArrowLeftRight, ClipboardCheck, Menu, X, LogOut, User, Bell, BarChart3, Webhook, Settings, Truck, RotateCcw, ShoppingCart } from 'lucide-react';
import { useAuth, useLogout } from '../hooks/useAuth';
import { useUnreadCount, useNotifications, useMarkAsRead, useMarkAllRead } from '../hooks/useNotifications';
import { formatDistanceToNow } from '../utils/dateFormat';

type NavItem = {
  to: string;
  icon: React.ReactNode;
  label: string;
  roles: string[];
};

const NAV_ITEMS: NavItem[] = [
  { to: '/', icon: <Package size={16} />, label: 'Products', roles: ['admin', 'manager'] },
  { to: '/orders', icon: <ClipboardList size={16} />, label: 'Orders', roles: ['admin', 'manager'] },
  { to: '/returns', icon: <RotateCcw size={16} />, label: 'Returns', roles: ['admin', 'manager'] },
  { to: '/inventory', icon: <Warehouse size={16} />, label: 'Inventory', roles: ['admin', 'manager', 'warehouse'] },
  { to: '/reports', icon: <BarChart3 size={16} />, label: 'Reports', roles: ['admin', 'manager'] },
  { to: '/transfers', icon: <ArrowLeftRight size={16} />, label: 'Transfers', roles: ['admin', 'manager', 'warehouse'] },
  { to: '/stocktakes', icon: <ClipboardCheck size={16} />, label: 'Stocktakes', roles: ['admin', 'manager', 'warehouse'] },
  { to: '/pick-list', icon: <AlertTriangle size={16} />, label: 'Pick List', roles: ['admin', 'manager', 'warehouse'] },
  { to: '/audit-logs', icon: <FileText size={16} />, label: 'Audit Logs', roles: ['admin', 'manager'] },
  { to: '/locations', icon: <MapPin size={16} />, label: 'Locations', roles: ['admin', 'manager', 'warehouse'] },
  { to: '/suppliers', icon: <Truck size={16} />, label: 'Suppliers', roles: ['admin', 'manager'] },
  { to: '/purchase-orders', icon: <ShoppingCart size={16} />, label: 'Purchase Orders', roles: ['admin', 'manager'] },
  { to: '/webhooks', icon: <Webhook size={16} />, label: 'Webhooks', roles: ['admin'] },
  { to: '/settings', icon: <Settings size={16} />, label: 'Settings', roles: ['admin', 'manager', 'warehouse'] },
];

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const { data: user } = useAuth();
  const logout = useLogout();
  const { data: unreadData } = useUnreadCount();
  const { data: notifData } = useNotifications(1, 10);
  const markRead = useMarkAsRead();
  const markAllRead = useMarkAllRead();

  // Close notification dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-blue-100 text-blue-700'
        : 'text-gray-600 hover:bg-gray-100'
    }`;

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const unreadCount = unreadData?.count ?? 0;
  const notifications = notifData?.data ?? [];
  const userRole = user?.role ?? '';
  const visibleNavItems = NAV_ITEMS.filter((item) => item.roles.includes(userRole));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 md:px-6 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Package size={20} className="text-blue-600" />
            Niche Inventory
          </h1>

          {/* Desktop nav */}
          <nav className="hidden lg:flex gap-1">
            {visibleNavItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={linkClass} end={item.to === '/'}>
                {item.icon} {item.label}
              </NavLink>
            ))}
          </nav>

          {/* User info, notifications, and logout */}
          {user && (
            <div className="hidden lg:flex items-center gap-2 ml-4 pl-4 border-l border-gray-200">
              {/* Notification bell */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setNotifOpen((prev) => !prev)}
                  className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition"
                  aria-label="Notifications"
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                      {unreadCount > 0 && (
                        <button
                          onClick={() => markAllRead.mutate()}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-6">No notifications</p>
                      )}
                      {notifications.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => {
                            if (!n.read) markRead.mutate(n.id);
                          }}
                          className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition ${
                            !n.read ? 'bg-blue-50/50' : ''
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {!n.read && <span className="w-2 h-2 mt-1.5 rounded-full bg-blue-500 shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm ${!n.read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                                {n.title}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                              <p className="text-[10px] text-gray-400 mt-1">{formatDistanceToNow(n.createdAt)}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

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
          <div className="flex items-center gap-2 lg:hidden">
            <button
              onClick={() => setNotifOpen((prev) => !prev)}
              className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-md transition"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="p-2 rounded-md text-gray-600 hover:bg-gray-100 transition"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile nav dropdown */}
        {mobileMenuOpen && (
          <nav className="lg:hidden mt-3 pt-3 border-t border-gray-100 flex flex-col gap-1 pb-1">
            {visibleNavItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={linkClass} end={item.to === '/'} onClick={closeMobileMenu}>
                {item.icon} {item.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      <main className="p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}
