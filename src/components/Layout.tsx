import { useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  FilePlus2,
  Search,
  LayoutDashboard,
  ShieldCheck,
  GitFork,
  BarChart3,
  Menu,
  X,
  LogOut,
  LogIn,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

const NAV_ITEMS = [
  { to: '/submit', label: 'Submit Report', icon: FilePlus2, roles: ['public', 'citizen', 'handler', 'admin'] },
  { to: '/track', label: 'Track & DFA', icon: Search, roles: ['public', 'citizen', 'handler', 'admin'] },
  { to: '/dashboard', label: 'My Complaints', icon: LayoutDashboard, roles: ['citizen', 'admin'] },
  { to: '/handler', label: 'Officer Console', icon: ShieldCheck, roles: ['handler', 'admin'] },
  { to: '/routing', label: 'Routing & Queue', icon: GitFork, roles: ['handler', 'admin'] },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, roles: ['handler', 'admin'] },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (!user) return item.roles.includes('public');
    return item.roles.includes(user.role) || item.roles.includes('public');
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: Brand wordmark — Concise nav links — Primary Action */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-md focus-visible:outline-2 focus-visible:outline-sky-700"
              aria-label="Toggle navigation menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Link
              to="/submit"
              className="text-lg font-bold tracking-tight text-slate-900 font-display whitespace-nowrap shrink-0"
            >
              FoodGuard Authority
            </Link>
          </div>

          <nav className="hidden lg:flex items-center gap-6 overflow-x-auto">
            {visibleNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                    isActive
                      ? 'text-sky-700 border-sky-700'
                      : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-4 shrink-0">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600 whitespace-nowrap">
                  <span className="font-medium text-slate-900">{user.name}</span>
                  <span aria-hidden="true">·</span>
                  <span className="capitalize">{user.role}</span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 space-y-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-sky-50 text-sky-800'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      )}

      {/* Workspace Body: Left Sidebar on Desktop + Main Content Viewport */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto flex">
        <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-slate-200 bg-white px-4 py-6">
          <p className="text-xs font-semibold text-slate-500 px-3 mb-3">
            Municipal Food Safety Portal
          </p>
          <nav className="space-y-1 flex-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-sky-50 text-sky-800'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-slate-200 px-3 space-y-1 text-xs text-slate-500">
            <p className="font-medium text-slate-700">Resolution SLA Policy</p>
            <p>High-Risk Categories: 48 hours</p>
            <p>Standard Categories: 72–120 hours</p>
          </div>
        </aside>

        <main className="flex-1 min-w-0 px-4 sm:px-8 py-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
