import { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  LayoutDashboard,
  ShieldCheck,
  LogOut,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useUIStore } from '../lib/uiStore';
import { motion } from 'framer-motion';

type AppShellProps = {
  children: ReactNode;
};

const navItems = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'text-blue-400', activeBg: 'bg-blue-500/10', activeBorder: 'border-blue-500/30' },
];

export function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  const email = user?.email || 'User';
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 flex">
      {/* Sidebar */}
      <aside
        className="h-screen sticky top-0 flex flex-col transition-all duration-200 ease-in-out border-r border-gray-800/60 bg-[#0e0e0e]"
        style={{ width: sidebarCollapsed ? 72 : 260 }}
      >
        {/* Brand */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-gray-800/50" >
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-tr from-blue-600 to-purple-600 p-1.5 rounded-lg shadow-lg">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-lg font-bold text-white tracking-tight">DevDiff</span>
                <span className="ml-2 px-1.5 py-0.5 rounded bg-gray-800 text-[11px] text-gray-400 font-mono">v0.1</span>
              </div>
            </div>
          ) : (
            <div className="mx-auto bg-gradient-to-tr from-blue-600 to-purple-600 p-1.5 rounded-lg shadow-lg">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
          )}
        </div>

        {/* Nav Links */}
        <nav className="px-3 py-4 space-y-1 flex-1">
          {!sidebarCollapsed && (
            <p className="text-xs uppercase tracking-widest text-gray-600 font-semibold px-3 mb-3">
              Navigation
            </p>
          )}
          {navItems.map(({ key, label, icon: Icon, color, activeBg, activeBorder }) => {
            const href = '/dashboard';
            const active = router.pathname === '/dashboard';

            return (
              <Link
                href={href}
                key={key}
                title={sidebarCollapsed ? label : undefined}
                className={`
                  group relative flex items-center gap-3 rounded-xl transition-all duration-150
                  ${sidebarCollapsed ? 'justify-center h-12 w-12 mx-auto' : 'h-12 px-3'}
                  ${active
                    ? `${activeBg} border ${activeBorder} shadow-sm`
                    : 'border border-transparent hover:bg-gray-800/40 hover:border-gray-700/30'
                  }
                `}
              >
                <Icon className={`w-5 h-5 transition-colors ${active ? color : 'text-gray-500 group-hover:text-gray-300'}`} />
                {!sidebarCollapsed && (
                  <span className={`text-base font-medium transition-colors ${active ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
                    {label}
                  </span>
                )}
                {active && !sidebarCollapsed && (
                  <motion.div
                    layoutId="activeIndicator"
                    className={`absolute right-3 w-1.5 h-1.5 rounded-full ${color.replace('text-', 'bg-')}`}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="p-3 border-t border-gray-800/50 space-y-2">
          {/* User Info */}
          <div className={`flex items-center gap-3 rounded-xl p-2 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-gray-700 to-gray-600 border-2 border-gray-500/30 flex items-center justify-center text-white text-sm font-bold shadow-inner shrink-0">
              {initials}
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-200 truncate">{email}</p>
                <p className="text-xs text-gray-600">developer</p>
              </div>
            )}
          </div>

          {/* Sign Out */}
          {signOut && (
            <button
              onClick={signOut}
              title="Sign out"
              className={`
                w-full flex items-center gap-3 rounded-xl transition-all duration-150
                text-gray-500 hover:text-red-400 hover:bg-red-500/5 hover:border-red-500/20 border border-transparent
                ${sidebarCollapsed ? 'justify-center h-11' : 'h-11 px-3'}
              `}
            >
              <LogOut className="w-5 h-5" />
              {!sidebarCollapsed && <span className="text-base font-medium">Sign out</span>}
            </button>
          )}

          {/* Collapse Toggle */}
          <button
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`
              w-full flex items-center gap-3 rounded-xl transition-all duration-150
              text-gray-500 hover:text-gray-200 hover:bg-gray-800/40 hover:border-gray-700/30 border border-transparent
              ${sidebarCollapsed ? 'justify-center h-11' : 'h-11 px-3'}
            `}
          >
            {sidebarCollapsed
              ? <PanelLeft className="w-5 h-5" />
              : <PanelLeftClose className="w-5 h-5" />
            }
            {!sidebarCollapsed && <span className="text-base font-medium">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
    </div>
  );
}
