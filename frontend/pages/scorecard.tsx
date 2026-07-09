import { useEffect, useState } from 'react';
import ScoreBar from '../components/ScoreBar';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Users, Activity, ShieldCheck, AlertTriangle } from 'lucide-react';

type DevScore = {
  author: string; score: number;
  critical_count: number; warning_count: number; info_count: number;
};

export default function Scorecard() {
  const [data, setData] = useState<DevScore[]>([]);
  const [loading, setLoading] = useState(true);
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  useEffect(() => {
    fetch(`${API}/api/scorecard`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const badge = (score: number) =>
    score >= 80 ? { label: 'Clean', cls: 'badge-low', icon: ShieldCheck } :
    score >= 50 ? { label: 'Watch', cls: 'badge-high', icon: Activity } :
                  { label: 'Risky', cls: 'badge-critical', icon: AlertTriangle };

  return (
    <div className="p-6 md:p-8 max-w-[1000px] mx-auto">
      <header className="mb-10">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-text-dim hover:text-accent transition text-sm font-medium mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold gradient-text flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-safe/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-safe" />
              </div>
              Team Health Scorecard
            </h1>
            <p className="text-sm text-text-dim mt-2">Monitor developer risk profiles and code quality patterns</p>
          </div>
          <div className="badge badge-info">Last 30 days</div>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Activity className="w-8 h-8 text-accent animate-spin" />
          <p className="mt-4 text-text-dim text-sm">Loading team scores...</p>
        </div>
      ) : data.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center p-16 glow-card text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-safe/10 flex items-center justify-center mb-5">
            <Users className="w-8 h-8 text-safe" />
          </div>
          <h2 className="text-xl font-bold text-text-bright mb-2">No team data yet</h2>
          <p className="text-text-dim max-w-md mb-8 text-sm">Run at least 2 PR analyses to reveal team patterns.</p>
          <Link href="/dashboard" className="btn-primary">Go to Dashboard</Link>
        </motion.div>
      ) : (
        <div className="grid gap-4">
          <AnimatePresence>
            {data.map((dev, idx) => {
              const b = badge(dev.score);
              const Icon = b.icon;
              return (
                <motion.div
                  key={dev.author}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className="glow-card p-6"
                >
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-surface-3 border border-border-subtle flex items-center justify-center text-text-bright text-lg font-bold">
                        {dev.author.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <Link href={`/profile/${encodeURIComponent(dev.author)}`} className="font-bold text-text-bright text-base hover:text-accent transition">
                          {dev.author}
                        </Link>
                        <div className="flex items-center gap-3 mt-1 text-sm">
                          <span className="text-critical font-medium flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {dev.critical_count} critical
                          </span>
                          <span className="text-text-dim">·</span>
                          <span className="text-high font-medium flex items-center gap-1">
                            <Activity className="w-3.5 h-3.5" />
                            {dev.warning_count} warnings
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className={`badge ${b.cls}`}>
                      <Icon className="w-3 h-3" />
                      {b.label}
                    </span>
                  </div>

                  <div className="mt-2 bg-surface-2/50 p-4 rounded-xl border border-border-faint">
                    <ScoreBar score={dev.score} />
                  </div>

                  {dev.score < 50 && (
                    <div className="mt-4 flex items-center gap-2 text-xs font-medium text-critical bg-critical/5 px-3 py-2 rounded-lg border border-critical/20">
                      <AlertTriangle className="w-4 h-4" />
                      Rules have been auto-escalated for this developer's future PRs.
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
