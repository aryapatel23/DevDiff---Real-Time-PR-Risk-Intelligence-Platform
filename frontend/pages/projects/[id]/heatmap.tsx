import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../../../lib/auth';
import { ArrowLeft, Activity, Flame, AlertCircle, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function ProjectHeatmapPage() {
  const router = useRouter();
  const { id } = router.query;
  const { session, loading, apiHeaders } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState('');

  const chartRows = rows.map((row) => {
    const critical = Number(row.critical || 0);
    const warning = Number(row.warning || 0);
    const info = Number(row.info || 0);
    const total = Number(row.total || critical + warning + info);
    return {
      ...row,
      critical, warning, info, total,
      shortName: String(row.filename || '').split('/').slice(-2).join('/'),
    };
  });

  useEffect(() => {
    if (!loading && !session) router.replace('/login');
  }, [loading, session, router]);

  useEffect(() => {
    if (!session || typeof id !== 'string') return;
    let cancelled = false;
    (async () => {
      try {
        setError('');
        const res = await fetch(`${API}/api/analytics/${id}/heatmap`, { headers: apiHeaders() });
        const payload = await res.json().catch(() => ([]));
        if (!res.ok) throw new Error((payload && payload.error) || 'Failed to load heatmap');
        if (!cancelled) setRows(Array.isArray(payload) ? payload : []);
      } catch (e: any) {
        if (!cancelled) { setRows([]); setError(e?.message || 'Failed to fetch heatmap.'); }
      }
    })();
    return () => { cancelled = true; };
  }, [session, id]);

  return (
    <div className="p-6 md:p-8 max-w-[1000px] mx-auto">
      <header className="mb-8">
        <Link href={`/projects/${id}`} className="inline-flex items-center gap-2 text-text-dim hover:text-accent transition text-sm font-medium mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Project
        </Link>
        <h1 className="text-2xl font-extrabold text-text-bright flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-high/10 flex items-center justify-center">
            <Flame className="w-5 h-5 text-high" />
          </div>
          Bug Density Heatmap
        </h1>
        <p className="text-sm text-text-dim mt-1">Findings per file across scanned PRs</p>
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

      <div className="glow-card p-5 mb-6">
        <p className="text-xs text-text-dim mb-4 uppercase tracking-wider font-semibold">Findings per file</p>
        {chartRows.length === 0 ? (
          <div className="h-44 bg-surface-2/50 rounded-xl border border-border-faint flex items-center justify-center text-sm text-text-dim">
            Analyze a PR to populate the heatmap
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--border-faint)" vertical={false} />
                <XAxis
                  dataKey="shortName"
                  tick={{ fill: 'var(--text-dim)', fontSize: 11, fontFamily: 'var(--font-geist-mono)' }}
                  axisLine={{ stroke: 'var(--border-faint)' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: 'var(--text-dim)', fontSize: 11, fontFamily: 'var(--font-geist-mono)' }}
                  axisLine={{ stroke: 'var(--border-faint)' }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 12,
                    fontSize: 12,
                    color: 'var(--text-normal)',
                  }}
                  labelStyle={{ color: 'var(--text-bright)', fontFamily: 'var(--font-geist-mono)' }}
                />
                <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                  {chartRows.map((entry: any, index: number) => {
                    const color = entry.total >= 10 ? 'var(--critical)' : entry.total >= 6 ? 'var(--high)' : entry.total >= 3 ? 'var(--info)' : 'var(--surface-3)';
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {chartRows.map(r => (
          <div key={r.filename} className="glow-card p-4 flex items-center justify-between text-sm">
            <span className="font-mono text-xs text-text-normal truncate mr-4">{r.filename}</span>
            <div className="flex items-center gap-3 shrink-0 text-xs">
              {r.critical > 0 && <span className="badge badge-critical">{r.critical} critical</span>}
              {r.warning > 0 && <span className="badge badge-high">{r.warning} warn</span>}
              {r.info > 0 && <span className="badge badge-info">{r.info} info</span>}
              <span className="text-text-dim font-semibold">{r.total} total</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
