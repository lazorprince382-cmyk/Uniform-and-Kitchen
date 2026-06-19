import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Shirt,
  ArrowDownToLine,
  Users,
  History,
  ClipboardList,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  UserCog,
  Shield,
  Settings,
  Search,
  Bell,
  ChevronDown,
  Menu,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import UserAvatar from './UserAvatar';
import { api } from '../api';
import SchoolBrand from './SchoolBrand';
import { SCHOOL } from '../config/school';

const navSections = [
  {
    title: 'MANAGEMENT',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/inventory', icon: Package, label: 'Inventory' },
      { to: '/products', icon: Shirt, label: 'Products' },
      { to: '/stock-in', icon: ArrowDownToLine, label: 'Add Stock' },
      { to: '/issue-uniform', icon: ClipboardList, label: 'Issue Uniform' },
      { to: '/uniform-history', icon: History, label: 'Uniform History' },
      { to: '/parents', icon: Users, label: 'Parents & Students' },
    ],
  },
  {
    title: 'REPORTS',
    items: [
      { to: '/reports/stock', icon: BarChart3, label: 'Stock Report' },
      { to: '/reports/collections', icon: TrendingUp, label: 'Issuances Report' },
      { to: '/reports/low-stock', icon: AlertTriangle, label: 'Low Stock Report' },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      { to: '/users', icon: UserCog, label: 'Users' },
      { to: '/roles', icon: Shield, label: 'Roles & Permissions' },
      { to: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSearch = async (q) => {
    setSearch(q);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const results = await api.dashboard.search(q);
      setSearchResults(results);
      setShowSearch(true);
    } catch {
      setSearchResults([]);
    }
  };

  useEffect(() => {
    api.dashboard
      .notifications()
      .then((d) => {
        setUnreadCount(d.unreadCount || 0);
        setNotifications(d.notifications || []);
      })
      .catch(() => {
        setUnreadCount(0);
        setNotifications([]);
      });
  }, []);

  const formatWhen = (value) => {
    if (!value) return '';
    const dt = new Date(value);
    return Number.isNaN(dt.getTime()) ? '' : dt.toLocaleString();
  };

  return (
    <div className="flex min-h-screen">
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-sidebar text-gray-300 flex flex-col transform transition-transform ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-5 border-b border-white/10">
          <SchoolBrand compact light />
          <p className="text-[10px] text-school-red-light font-semibold tracking-wide mt-2 px-1">
            {SCHOOL.motto}
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {navSections.map((section) => (
            <div key={section.title} className="mb-6">
              <p className="text-[10px] font-semibold text-school-red-light/90 tracking-wider px-3 mb-2">
                {section.title}
              </p>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-0.5 transition ${
                      isActive
                        ? 'bg-sidebar-active text-white'
                        : 'hover:bg-sidebar-hover text-gray-300'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-3 flex items-center gap-4 sticky top-0 z-20">
          <button
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1 max-w-xl relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search items, parents, students, issuances..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-school-red/40 focus:border-school-red"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => search.length >= 2 && setShowSearch(true)}
              onBlur={() => setTimeout(() => setShowSearch(false), 200)}
            />
            {showSearch && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 max-h-60 overflow-auto">
                {searchResults.map((r) => (
                  <button
                    key={`${r.type}-${r.id}`}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm"
                    onClick={() => {
                      setShowSearch(false);
                      setSearch('');
                      if (r.type === 'product') navigate('/products');
                      else if (r.type === 'issuance') navigate('/orders');
                      else if (r.type === 'parent' || r.type === 'student') navigate('/parents');
                    }}
                  >
                    <span className="text-gray-400 text-xs uppercase">{r.type}</span>{' '}
                    {r.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              className="relative p-2 hover:bg-gray-100 rounded-lg"
              onClick={() => setShowNotifications((v) => !v)}
              onBlur={() => setTimeout(() => setShowNotifications(false), 150)}
              title="Notifications"
            >
              <Bell className="w-5 h-5 text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-full mt-1 w-80 max-w-[90vw] bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-800">Notifications</p>
                </div>
                <div className="max-h-72 overflow-auto">
                  {notifications.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-gray-500">No notifications yet.</p>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className="px-3 py-2.5 border-b border-gray-50 last:border-0">
                        <p className="text-sm text-gray-800">{n.message || n.title || 'Notification'}</p>
                        {n.created_at && (
                          <p className="text-xs text-gray-400 mt-1">{formatWhen(n.created_at)}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pl-2 border-l border-gray-200">
            <UserAvatar user={user} className="w-9 h-9 rounded-full bg-gray-200 object-cover ring-1 ring-gray-200" />
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-gray-800">{user?.full_name}</p>
              <p className="text-xs text-gray-500">{user?.role_name || 'Administrator'}</p>
            </div>
            <button onClick={logout} className="text-xs text-gray-500 hover:text-red-600 ml-2">
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
