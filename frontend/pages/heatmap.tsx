import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Flame, Activity, ShieldAlert } from 'lucide-react';

type HeatRow = { filename: string; critical: number; warning: number; info: number; total: number };

export default function Heatmap() {
  const [data, setData] = useState<HeatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  useEffect(() => {
    fetch(`${API}/api/heatmap`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const truncate = (s: string, n = 38) => s.length > n ? '…' + s.slice(-n) : s;

  return (
    <div className="p-6 md:p-8 max-w-[1000px] mx-auto">
      <header className="mb-10">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-text-dim hover:text-accent transition text-sm font-medium mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <h1 className="text-3xl font-extrabold gradient-text flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-high/10 flex items-center justify-center">
            <Flame className="w-6 h-6 text-high" />
          </div>
          Codebase Bug Heatmap
        </h1>
        <p className="text-sm text-text-dim mt-2">Visualize which files accumulate the most security risks</p>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Activity className="w-8 h-8 text-high animate-spin" />
          <p className="mt-4 text-text-dim text-sm">Loading heatmap data...</p>
        </div>
      ) : data.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center p-16 glow-card text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-high/10 flex items-center justify-center mb-5">
            <Flame className="w-8 h-8 text-high" />
          </div>
          <h2 className="text-xl font-bold text-text-bright mb-2">No data yet</h2>
          <p className="text-text-dim max-w-md mb-8 text-sm">Run at least 1 PR analysis to see which files are the riskiest.</p>
          <Link href="/dashboard" className="btn-primary">Go to Dashboard</Link>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glow-card p-6">
          <ResponsiveContainer width="100%" height={Math.max(300, data.length * 45)}>
            <BarChart data={data} layout="vertical" margin={{ left: 20, right: 40, top: 10, bottom: 10 }}>
              <XAxis type="number" tick={{ fill: 'var(--text-dim)', fontSize: 12 }} />
              <YAxis type="category" dataKey="filename" width={260}
                tick={{ fill: 'var(--text-normal)', fontSize: 12, fontFamily: 'monospace' }}
                tickFormatter={(v: string) => truncate(v)}
              />
              <Tooltip
                cursor={{ fill: 'var(--surface-2)' }}
                contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
                labelStyle={{ color: 'var(--text-bright)', fontSize: 13, fontWeight: 'bold', marginBottom: 8 }}
                itemStyle={{ fontSize: 13 }}
              />
              <Bar dataKey="critical" stackId="a" name="Critical" fill="var(--critical)" radius={[0, 0, 0, 0]}>
                {data.map((row, i) => (
                  <Cell key={i} fill={row.total >= 5 ? '#cc1a52' : 'var(--critical)'} />
                ))}
              </Bar>
              <Bar dataKey="warning" stackId="a" name="Warning" fill="var(--high)" />
              <Bar dataKey="info" stackId="a" name="Info" fill="var(--surface-3)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>

          {data.some(r => r.total >= 5) && (
            <div className="mt-8 space-y-3 border-t border-border-faint pt-6">
              <h3 className="text-base font-bold text-text-bright flex items-center gap-2 mb-4">
                <ShieldAlert className="w-4 h-4 text-critical" />
                Requires Immediate Attention
              </h3>
              {data.filter(r => r.total >= 5).map(r => (
                <div key={r.filename} className="bg-critical/5 border border-critical/20 rounded-xl px-5 py-4 text-sm flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-critical font-bold tracking-wide text-xs">DANGER ZONE</span>
                    <span className="text-text-normal font-mono text-xs">{r.filename}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-text-bright font-bold text-lg">{r.total}</span>
                    <span className="text-text-dim ml-1">total bugs</span>
                    <p className="text-critical/70 text-xs mt-0.5">Schedule a refactor sprint.</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
