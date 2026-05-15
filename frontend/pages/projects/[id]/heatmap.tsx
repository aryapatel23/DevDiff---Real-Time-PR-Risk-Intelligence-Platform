import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../../../lib/auth';
import { ArrowLeft, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

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
      critical,
      warning,
      info,
      total,
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
        if (!cancelled) {
          setRows([]);
          setError(e?.message || 'Failed to fetch heatmap. Ensure backend is running on port 4000.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, id]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <Link href={`/projects/${id}`} className="h-9 px-3 rounded-md border border-border-default text-text-secondary hover:bg-bg-overlay hover:text-text-primary transition-colors duration-80 inline-flex items-center gap-2 text-sm font-medium">
            <ArrowLeft size={16} />
            Back
          </Link>
          <Link href={`/projects/${id}/scorecard`} className="h-9 px-3 rounded-md border border-border-default text-text-secondary hover:bg-bg-overlay hover:text-text-primary transition-colors duration-80 inline-flex items-center gap-2 text-sm font-medium">
            <Activity size={16} />
            Scorecard
          </Link>
        </div>
        <h1 className="text-xl font-bold my-4">Heatmap</h1>
        {error && <div className="mb-3 bg-red-950 border border-red-800 rounded p-3 text-sm">{error}</div>}

        <div className="bg-bg-surface border border-border-subtle rounded-lg p-4 mb-4">
          <p className="text-[13px] text-text-secondary mb-3">Findings per file (scanned PRs)</p>
          {chartRows.length === 0 ? (
            <div className="h-44 bg-bg-elevated rounded-md border border-border-subtle flex items-center justify-center text-sm text-text-muted">
              Analyze a PR to populate the heatmap
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartRows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
                  <XAxis
                    dataKey="shortName"
                    tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-geist-mono)' }}
                    axisLine={{ stroke: 'var(--border-subtle)' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-geist-mono)' }}
                    axisLine={{ stroke: 'var(--border-subtle)' }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 8,
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                    }}
                    labelStyle={{ color: 'var(--text-primary)', fontFamily: 'var(--font-geist-mono)' }}
                  />
                  <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                    {chartRows.map((entry: any, index: number) => {
                      const color = entry.total >= 10 ? 'var(--critical)' : entry.total >= 6 ? '#c44520' : entry.total >= 3 ? '#1a4e7a' : '#1a2e48';
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
            <div key={r.filename} className="bg-gray-900 border border-gray-800 rounded p-3 text-sm flex justify-between">
              <span className="font-mono text-xs">{r.filename}</span>
              <span className="text-gray-400">critical {r.critical} · warning {r.warning} · info {r.info} · total {r.total}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
