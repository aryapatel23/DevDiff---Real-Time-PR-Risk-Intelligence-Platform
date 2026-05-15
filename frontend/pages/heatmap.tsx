import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Flame, Activity, ShieldAlert } from 'lucide-react';

type HeatRow = { filename: string; critical: number; warning: number; info: number; total: number };

export default function Heatmap() {
  const [data, setData]     = useState<HeatRow[]>([]);
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
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 p-6 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-col gap-2 mb-10 pb-6 border-b border-gray-800/50">
          <Link href="/dashboard" className="flex items-center gap-2 text-gray-500 hover:text-white transition w-fit text-sm font-medium mb-2">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent flex items-center gap-3">
                <Flame className="w-8 h-8 text-orange-500" />
                Codebase Bug Heatmap
              </h1>
              <p className="text-sm text-gray-500 mt-1">Visualize which files accumulate the most security risks</p>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Activity className="w-8 h-8 text-orange-500 animate-spin" />
            <p className="mt-4 text-gray-500">Loading heatmap data...</p>
          </div>
        ) : data.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center p-16 bg-[#111] border border-gray-800/60 rounded-3xl text-center shadow-2xl"
          >
            <div className="bg-orange-900/20 p-6 rounded-full mb-6 relative border border-orange-500/20">
              <Flame className="w-12 h-12 text-orange-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">No data yet</h2>
            <p className="text-gray-400 max-w-md mb-8">
              We need a bit more data to build your heatmap. Run at least 1 PR analysis to see which files are the riskiest.
            </p>
            <Link 
              href="/dashboard" 
              className="bg-white text-black hover:bg-gray-200 transition px-6 py-3 rounded-xl font-semibold shadow-lg"
            >
              Go to Dashboard
            </Link>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#111] border border-gray-800 rounded-3xl p-6 shadow-2xl"
          >
            <ResponsiveContainer width="100%" height={Math.max(300, data.length * 45)}>
              <BarChart data={data} layout="vertical" margin={{ left: 20, right: 40, top: 10, bottom: 10 }}>
                <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <YAxis type="category" dataKey="filename" width={260}
                  tick={{ fill: '#d1d5db', fontSize: 12, fontFamily: 'monospace' }}
                  tickFormatter={(v: string) => truncate(v)}
                />
                <Tooltip
                  cursor={{ fill: '#1f2937' }}
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 12, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                  labelStyle={{ color: '#f9fafb', fontSize: 13, fontWeight: 'bold', marginBottom: 8 }}
                  itemStyle={{ fontSize: 13 }}
                />
                <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 13, paddingTop: 10 }} />
                <Bar dataKey="critical" stackId="a" name="Critical" fill="#ef4444" radius={[0, 0, 0, 0]}>
                  {data.map((row, i) => (
                    <Cell key={i} fill={row.total >= 5 ? '#b91c1c' : '#ef4444'} />
                  ))}
                </Bar>
                <Bar dataKey="warning" stackId="a" name="Warning" fill="#f59e0b" />
                <Bar dataKey="info" stackId="a" name="Info" fill="#6b7280" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>

            {data.some(r => r.total >= 5) && (
              <div className="mt-8 space-y-3 border-t border-gray-800/60 pt-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                  <ShieldAlert className="w-5 h-5 text-red-500" />
                  Requires Immediate Attention
                </h3>
                {data.filter(r => r.total >= 5).map(r => (
                  <div key={r.filename} className="bg-red-950/30 border border-red-900/50 rounded-xl px-5 py-4 text-sm flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="text-red-400 font-bold tracking-wide">DANGER ZONE</span>
                      <span className="text-gray-300 font-mono text-xs">{r.filename}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-white font-bold text-lg">{r.total}</span>
                      <span className="text-gray-400 ml-1">total bugs</span>
                      <p className="text-red-400/80 text-xs mt-0.5">Schedule a refactor sprint.</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
