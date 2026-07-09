import { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ShieldCheck, LogOut } from 'lucide-react';
import { useAuth } from '../lib/auth';

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const email = user?.email || 'User';
  const initials = email.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-surface-0 bg-grid text-text-normal">
      {/* Top Navigation Bar */}
      <header className="topbar">
        {/* Left: Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
            <ShieldCheck className="w-4.5 h-4.5 text-accent" />
          </div>
          <span className="text-base font-bold text-text-bright tracking-tight hidden sm:block">
            Dev<span className="text-accent">Diff</span>
          </span>
        </Link>

        {/* Center: Nav links */}
        <nav className="flex items-center gap-1">
          <Link
            href="/dashboard"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              router.pathname === '/dashboard'
                ? 'bg-accent/10 text-accent'
                : 'text-text-dim hover:text-text-normal hover:bg-surface-2'
            }`}
          >
            Dashboard
          </Link>
        </nav>

        {/* Right: User + Sign out */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-surface-3 border border-border-subtle flex items-center justify-center text-xs font-bold text-text-bright">
              {initials}
            </div>
            <span className="text-sm text-text-dim hidden md:block max-w-[120px] truncate">{email}</span>
          </div>
          <button
            onClick={signOut}
            className="p-2 rounded-lg text-text-dim hover:text-critical hover:bg-critical/10 transition-all"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="min-h-[calc(100vh-56px)]">{children}</main>
    </div>
  );
}
