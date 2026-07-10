import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../../../lib/auth';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  DollarSign,
  Cpu,
  TrendingUp,
  Zap,
  Clock,
  Loader2,
  AlertCircle,
  Activity,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type CostSummary = {
  totalCalls: number;
  freeCalls: number;
  paidCalls: number;
  totalCost: number;
  estimatedWithoutCascade: number;
  savingsPercent: number;
  avgLatencyMs: number;
  avgQuality: number;
  escalationRate: number;
};

type ModelDist = {
  model_used: string;
  count: number;
  total_cost: number;
  avg_quality: number;
  avg_latency: number;
};

type Decision = {
  id: number;
  chunk_filename: string;
  chunk_function: string;
  model_used: string;
  model_cost: number;
  latency_ms: number;
  quality_score: number;
  escalated: boolean;
  created_at: string;
};

export default function CostDashboardPage() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : '';
  const { session, loading, apiHeaders } = useAuth();

  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [modelDist, setModelDist] = useState<ModelDist[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !session) router.replace('/login');
  }, [loading, session, router]);

  useEffect(() => {
    if (!id || !session) return;

    async function loadData() {
      try {
        const [summaryRes, decisionsRes] = await Promise.all([
          fetch(`${API}/api/analytics/${id}/costs`, { headers: apiHeaders() }),
          fetch(`${API}/api/analytics/${id}/costs/decisions?limit=50`, { headers: apiHeaders() }),
        ]);

        if (summaryRes.ok) {
          const data = await summaryRes.json();
          setSummary(data);
          setModelDist(data.modelDistribution || []);
        }

        if (decisionsRes.ok) {
          const data = await decisionsRes.json();
          setDecisions(Array.isArray(data) ? data : data.decisions || []);
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load cost data');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [id, session]);

  if (loading || !session) return <div className="min-h-screen bg-void" />;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  const totalCalls = summary?.totalCalls || 0;
  const totalCost = summary?.totalCost || 0;
  const avgQuality = summary?.avgQuality || 0;
  const escalationRate = summary?.escalationRate || 0;
  const savingsPercent = summary?.savingsPercent || 0;

  return (
    <div className="p-6 md:p-8 max-w-[1200px] mx-auto">
      {/* Header */}
      <header className="mb-8">
        <Link
          href={`/projects/${id}`}
          className="inline-flex items-center gap-2 text-text-dim hover:text-accent transition text-sm font-medium mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Project
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-text-bright">Cost Analytics</h1>
            <p className="text-sm text-text-dim">CascadeFlow model routing and token usage</p>
          </div>
        </div>
      </header>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-center gap-3 bg-critical/10 border border-critical/20 rounded-xl px-4 py-3 text-sm text-critical">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glow-card p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-accent" />
              </div>
              <span className="text-xs text-text-dim font-medium">Total Cost</span>
            </div>
            <p className="text-2xl font-bold text-text-bright">${totalCost.toFixed(4)}</p>
            <p className="text-xs text-text-dim mt-1">{totalCalls} requests</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="glow-card p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-safe/10 flex items-center justify-center">
                <Cpu className="w-5 h-5 text-safe" />
              </div>
              <span className="text-xs text-text-dim font-medium">Avg Quality</span>
            </div>
            <p className="text-2xl font-bold text-text-bright">{avgQuality.toFixed(2)}</p>
            <p className="text-xs text-text-dim mt-1">CascadeFlow quality gate</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glow-card p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-high/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-high" />
              </div>
              <span className="text-xs text-text-dim font-medium">Escalation Rate</span>
            </div>
            <p className="text-2xl font-bold text-text-bright">{escalationRate}%</p>
            <p className="text-xs text-text-dim mt-1">Free &rarr; Paid model</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="glow-card p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-info" />
              </div>
              <span className="text-xs text-text-dim font-medium">Cost Savings</span>
            </div>
            <p className="text-2xl font-bold text-text-bright">{savingsPercent}%</p>
            <p className="text-xs text-text-dim mt-1">vs. paid-only</p>
          </motion.div>
        </div>
      )}

      {/* Model Distribution */}
      {modelDist.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glow-card p-6 mb-8"
        >
          <h2 className="text-base font-bold text-text-bright flex items-center gap-2 mb-4">
            <Cpu className="w-4 h-4 text-accent" />
            Model Distribution
          </h2>
          <div className="space-y-3">
            {modelDist.map((m) => {
              const pct = totalCalls > 0 ? (m.count / totalCalls) * 100 : 0;
              const isFree = m.total_cost === 0;
              return (
                <div key={m.model_used} className="flex items-center gap-3">
                  <div className="w-48 truncate text-sm font-mono text-text-bright">{m.model_used}</div>
                  <div className="flex-1 h-2 rounded-full bg-surface-3 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${isFree ? 'bg-safe' : 'bg-accent'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                  <div className="w-24 text-right text-sm text-text-dim">{m.count} ({pct.toFixed(0)}%)</div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Recent Decisions */}
      {decisions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glow-card overflow-hidden mb-8"
        >
          <div className="px-6 py-4 border-b border-border-faint">
            <h2 className="text-base font-bold text-text-bright flex items-center gap-2">
              <Activity className="w-4 h-4 text-accent" />
              Recent Routing Decisions
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-faint text-text-dim text-left">
                  <th className="px-6 py-3 font-medium">Time</th>
                  <th className="px-6 py-3 font-medium">File</th>
                  <th className="px-6 py-3 font-medium">Model</th>
                  <th className="px-6 py-3 font-medium">Quality</th>
                  <th className="px-6 py-3 font-medium">Latency</th>
                  <th className="px-6 py-3 font-medium">Cost</th>
                  <th className="px-6 py-3 font-medium">Escalated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-faint">
                {decisions.map((d) => (
                  <tr key={d.id} className="hover:bg-surface-2/30 transition">
                    <td className="px-6 py-3 text-text-dim whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        {new Date(d.created_at).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-3 font-mono text-text-bright truncate max-w-[200px]">
                      {d.chunk_filename || '-'}
                    </td>
                    <td className="px-6 py-3 font-mono text-text-bright truncate max-w-[200px]">
                      {d.model_used}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`font-semibold ${
                        d.quality_score >= 0.7 ? 'text-safe' : d.quality_score >= 0.4 ? 'text-high' : 'text-critical'
                      }`}>
                        {d.quality_score.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-text-dim tabular-nums">{d.latency_ms}ms</td>
                    <td className="px-6 py-3 text-text-dim tabular-nums">${d.model_cost.toFixed(4)}</td>
                    <td className="px-6 py-3">
                      {d.escalated ? (
                        <span className="badge badge-accent">Yes</span>
                      ) : (
                        <span className="badge badge-info">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {!summary && !error && (
        <div className="glow-card p-12 text-center">
          <DollarSign className="w-12 h-12 text-text-dim mx-auto mb-4" />
          <h3 className="text-lg font-bold text-text-bright mb-2">No Cost Data Yet</h3>
          <p className="text-sm text-text-dim max-w-md mx-auto">
            Run some PR analyses to see CascadeFlow cost analytics. The model cascade will automatically route requests
            through free models first, only escalating when quality thresholds aren&apos;t met.
          </p>
        </div>
      )}
    </div>
  );
}
