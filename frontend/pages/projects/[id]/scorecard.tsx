import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../../../lib/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, BarChart3, Users, AlertCircle, ShieldCheck, Activity, AlertTriangle, ChevronRight } from 'lucide-react';

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
        if (!res.ok) {
          throw new Error((payload && payload.error) || 'Failed to load scorecard');
        }
        if (!cancelled) setRows(Array.isArray(payload) ? payload : []);
      } catch (e: any) {
        if (!cancelled) {
          setRows([]);
          setError(e?.message || 'Failed to fetch scorecard. Ensure backend is running on port 4000.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, id]);

  function badge(score: number) {
    if (score >= 80) return { label: 'Clean', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: ShieldCheck };
    if (score >= 50) return { label: 'Watch', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: Activity };
    return { label: 'Risky', cls: 'bg-red-500/10 text-red-400 border-red-500/20', icon: AlertTriangle };
  }

  function scoreColor(score: number) {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-red-400';
  }

  function barColor(score: number) {
    if (score >= 80) return 'from-emerald-500 to-emerald-600';
    if (score >= 50) return 'from-amber-500 to-amber-600';
    return 'from-red-500 to-red-600';
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 p-6">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8 pb-6 border-b border-gray-800/50">
          <Link href={`/projects/${id}`} className="flex items-center gap-2 text-gray-500 hover:text-white transition w-fit text-sm font-medium mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to Project
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-emerald-400" />
            Developer Scorecard
          </h1>
          <p className="text-sm text-gray-500 mt-1">{rows.length} developer{rows.length !== 1 ? 's' : ''} tracked</p>
        </header>

        {error && (
          <div className="mb-6 flex items-center gap-3 bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-3 text-sm text-red-200">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            {error}
          </div>
        )}

        {rows.length === 0 && !error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center p-16 bg-[#111] border border-gray-800/60 rounded-3xl text-center shadow-2xl"
          >
            <div className="bg-emerald-900/20 p-6 rounded-full mb-6 border border-emerald-500/20">
              <Users className="w-12 h-12 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">No developer data yet</h2>
            <p className="text-gray-400 max-w-md mb-6">
              Analyze a few pull requests to start building developer risk profiles and health scores.
            </p>
            <Link href={`/projects/${id}`} className="bg-white text-black hover:bg-gray-200 transition px-6 py-3 rounded-xl font-semibold shadow-lg">
              Go to Project
            </Link>
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
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                >
                  <Link
                    href={`/projects/${id}/developer/${encodeURIComponent(r.author)}`}
                    className="block bg-[#111] border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition shadow-lg group"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-gray-700 to-gray-600 border-2 border-gray-500/30 flex items-center justify-center text-white text-sm font-bold shadow-inner">
                          {r.author.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-base font-semibold text-white group-hover:text-blue-400 transition">{r.author}</p>
                          <p className="text-sm text-gray-500 mt-0.5">Developer</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-2 border px-3 py-1.5 rounded-lg ${b.cls}`}>
                          <Icon className="w-4 h-4" />
                          <span className="text-sm font-semibold">{b.label}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition" />
                      </div>
                    </div>

                    {/* Score Bar */}
                    <div className="flex items-center gap-4">
                      <div className="flex-1 bg-gray-800 rounded-full h-2.5 overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full bg-gradient-to-r ${barColor(r.score)}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${r.score}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut', delay: idx * 0.04 + 0.2 }}
                        />
                      </div>
                      <span className={`text-lg font-bold tabular-nums min-w-[50px] text-right ${scoreColor(r.score)}`}>{r.score}</span>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
