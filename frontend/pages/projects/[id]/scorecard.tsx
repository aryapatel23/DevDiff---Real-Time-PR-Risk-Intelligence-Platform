import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../../../lib/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, BarChart3, Users, AlertCircle, ShieldCheck, Activity, AlertTriangle, ChevronRight, X } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function ProjectScorecardPage() {
  const router = useRouter();
  const { id } = router.query;
  const { session, loading, apiHeaders } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !session) router.replace('/login');
  }, [loading, session, router]);

  useEffect(() => {
    if (!session || typeof id !== 'string') return;
    let cancelled = false;
    (async () => {
      try {
        setError('');
        const res = await fetch(`${API}/api/analytics/${id}/scorecard`, { headers: apiHeaders() });
        const payload = await res.json().catch(() => ([]));
        if (!res.ok) throw new Error((payload && payload.error) || 'Failed to load scorecard');
        if (!cancelled) setRows(Array.isArray(payload) ? payload : []);
      } catch (e: any) {
        if (!cancelled) { setRows([]); setError(e?.message || 'Failed to fetch scorecard.'); }
      }
    })();
    return () => { cancelled = true; };
  }, [session, id]);

  function badge(score: number) {
    if (score >= 80) return { label: 'Clean', cls: 'badge-low', icon: ShieldCheck };
    if (score >= 50) return { label: 'Watch', cls: 'badge-high', icon: Activity };
    return { label: 'Risky', cls: 'badge-critical', icon: AlertTriangle };
  }

  function scoreColor(score: number) {
    if (score >= 80) return 'text-safe';
    if (score >= 50) return 'text-high';
    return 'text-critical';
  }

  function barColor(score: number) {
    if (score >= 80) return 'bg-safe';
    if (score >= 50) return 'bg-high';
    return 'bg-critical';
  }

  return (
    <div className="p-6 md:p-8 max-w-[1000px] mx-auto">
      <header className="mb-8">
        <Link href={`/projects/${id}`} className="inline-flex items-center gap-2 text-text-dim hover:text-accent transition text-sm font-medium mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Project
        </Link>
        <h1 className="text-2xl font-extrabold text-text-bright flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-safe/10 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-safe" />
          </div>
          Developer Scorecard
        </h1>
        <p className="text-sm text-text-dim mt-1">{rows.length} developer{rows.length !== 1 ? 's' : ''} tracked</p>
      </header>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-6 flex items-center gap-3 bg-critical/10 border border-critical/20 rounded-xl px-4 py-3 text-sm text-critical"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError('')} className="text-critical/60 hover:text-critical"><X className="w-4 h-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {rows.length === 0 && !error && (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center p-16 glow-card text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-safe/10 flex items-center justify-center mb-5">
            <Users className="w-8 h-8 text-safe" />
          </div>
          <h2 className="text-xl font-bold text-text-bright mb-2">No developer data yet</h2>
          <p className="text-text-dim max-w-md mb-6 text-sm">Analyze a few pull requests to start building developer risk profiles.</p>
          <Link href={`/projects/${id}`} className="btn-primary">Go to Project</Link>
        </motion.div>
      )}

      <div className="space-y-3">
        <AnimatePresence>
          {rows.map((r, idx) => {
            const b = badge(r.score);
            const Icon = b.icon;
            return (
              <motion.div
                key={r.author}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
              >
                <Link
                  href={`/projects/${id}/developer/${encodeURIComponent(r.author)}`}
                  className="block glow-card p-5 group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-full bg-surface-3 border border-border-subtle flex items-center justify-center text-text-bright text-sm font-bold">
                        {r.author.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text-bright group-hover:text-accent transition">{r.author}</p>
                        <p className="text-xs text-text-dim mt-0.5">Developer</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`badge ${b.cls}`}>
                        <Icon className="w-3 h-3" />
                        {b.label}
                      </span>
                      <ChevronRight className="w-4 h-4 text-text-dim group-hover:text-accent transition" />
                    </div>
                  </div>

                  {/* Score Bar */}
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-2 rounded-full bg-surface-3 overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${barColor(r.score)}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${r.score}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: idx * 0.03 + 0.2 }}
                      />
                    </div>
                    <span className={`text-lg font-bold tabular-nums min-w-[48px] text-right ${scoreColor(r.score)}`}>{r.score}</span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
