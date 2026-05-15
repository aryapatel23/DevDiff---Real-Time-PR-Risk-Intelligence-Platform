import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '../../../../lib/auth';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  User,
  GitPullRequest,
  ShieldAlert,
  AlertTriangle,
  AlertCircle,
  Zap,
  Activity,
  ShieldCheck,
  Cpu,
  TrendingUp,
  FileCode2,
} from 'lucide-react';

type DeveloperPayload = {
  profile: {
    github_login: string;
    rule_weights: Record<string, number>;
    rule_thresholds: Record<string, number>;
    weights_updated_at?: string | null;
    total_prs_analyzed: number;
    total_findings: number;
    total_critical: number;
    total_warnings: number;
  };
  top_rules: Array<{ rule_name: string; total: string; critical: string }>;
  recent_prs: Array<{ id: number; pr_title: string; pr_number: number; risk_score: number; analyzed_at: string }>;
};

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function DeveloperProfilePage() {
  const router = useRouter();
  const { id, author } = router.query;
  const { session, loading, apiHeaders } = useAuth();
  const [data, setData] = useState<DeveloperPayload | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !session) router.replace('/login');
  }, [loading, session, router]);

  useEffect(() => {
    if (!session || typeof id !== 'string' || typeof author !== 'string') return;
    fetch(`${API}/api/developer/${id}/${encodeURIComponent(author)}`, { headers: apiHeaders() })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Failed to load developer profile');
        setData(d);
      })
      .catch(e => setError(e.message));
  }, [session, id, author]);

  const qualityScore = useMemo(() => {
    if (!data) return 0;
    return Math.max(0, 100 - data.profile.total_critical * 8 - data.profile.total_warnings * 2);
  }, [data]);

  const hasWeights = data && Object.keys(data.profile.rule_weights || {}).length > 0;

  function scoreColor(s: number) {
    if (s >= 80) return 'text-emerald-400';
    if (s >= 50) return 'text-amber-400';
    return 'text-red-400';
  }
  function scoreBg(s: number) {
    if (s >= 80) return 'from-emerald-500 to-emerald-600';
    if (s >= 50) return 'from-amber-500 to-amber-600';
    return 'from-red-500 to-red-600';
  }
  function riskColor(s: number) {
    if (s >= 70) return 'text-red-400';
    if (s >= 40) return 'text-amber-400';
    return 'text-emerald-400';
  }

  if (loading || !session) return <div className="min-h-screen bg-[#0a0a0a]" />;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="mb-8 pb-6 border-b border-gray-800/50">
          <Link href={`/projects/${id}/scorecard`} className="flex items-center gap-2 text-gray-500 hover:text-white transition w-fit text-sm font-medium mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to Scorecard
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <User className="w-7 h-7 text-blue-400" />
            Developer Profile
          </h1>
        </header>

        {error && (
          <div className="mb-6 flex items-center gap-3 bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-3 text-sm text-red-200">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            {error}
          </div>
        )}

        {data && (
          <>
            {/* Profile Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#111] border border-gray-800 rounded-2xl p-6 mb-6 shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white text-xl font-bold shadow-lg">
                    {data.profile.github_login.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{data.profile.github_login}</h2>
                    {hasWeights && (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2.5 py-1 rounded-lg font-medium">
                          <Cpu className="w-3 h-3" /> Personal model active
                        </span>
                        {data.profile.weights_updated_at ? (
                          <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg font-medium">
                            <TrendingUp className="w-3 h-3" /> Updated {new Date(data.profile.weights_updated_at).toLocaleString()}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 mb-1">Quality Score</p>
                  <div className="flex items-center gap-3">
                    <div className="w-24 bg-gray-800 rounded-full h-2 overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full bg-gradient-to-r ${scoreBg(qualityScore)}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${qualityScore}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                    <span className={`text-3xl font-extrabold tabular-nums ${scoreColor(qualityScore)}`}>{qualityScore}</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Stats Grid */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
            >
              <StatCard icon={GitPullRequest} iconColor="text-blue-400" iconBg="bg-blue-900/20" value={data.profile.total_prs_analyzed} label="PRs Analyzed" />
              <StatCard icon={ShieldAlert} iconColor="text-amber-400" iconBg="bg-amber-900/20" value={data.profile.total_findings} label="Total Findings" />
              <StatCard icon={AlertTriangle} iconColor="text-red-400" iconBg="bg-red-900/20" value={data.profile.total_critical} label="Critical" />
              <StatCard icon={Activity} iconColor="text-orange-400" iconBg="bg-orange-900/20" value={data.profile.total_warnings} label="Warnings" />
            </motion.div>

            {/* Detection Sensitivity */}
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-[#111] border border-gray-800 rounded-2xl p-6 mb-6 shadow-lg"
            >
              <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-5">
                <TrendingUp className="w-5 h-5 text-purple-400" />
                Personalized Detection Sensitivity
              </h3>
              {!hasWeights ? (
                <div className="flex flex-col items-center py-8 text-gray-500">
                  <Cpu className="w-8 h-8 mb-3 text-gray-600" />
                  <p className="text-sm">Analyzing patterns... Need more PRs to build a personal model.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(data.profile.rule_weights).map(([rule, weight], idx) => {
                    const pct = Math.min(100, (weight / 2.5) * 100);
                    const barColor = weight > 1.2 ? 'from-red-500 to-red-600' : weight < 0.8 ? 'from-emerald-500 to-emerald-600' : 'from-gray-500 to-gray-600';
                    const tagColor = weight > 1.2 ? 'text-red-400 bg-red-500/10 border-red-500/20' : weight < 0.8 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-gray-400 bg-gray-800 border-gray-700';
                    return (
                      <motion.div
                        key={rule}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm text-gray-300 font-mono">{rule}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${tagColor}`}>{weight.toFixed(2)}x</span>
                        </div>
                        <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full bg-gradient-to-r ${barColor}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, delay: idx * 0.03 }}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.section>

            {/* Top Triggered Rules */}
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-[#111] border border-gray-800 rounded-2xl p-6 mb-6 shadow-lg"
            >
              <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-5">
                <Zap className="w-5 h-5 text-amber-400" />
                Top Triggered Rules
              </h3>
              <div className="space-y-2">
                {data.top_rules.map((r, idx) => (
                  <motion.div
                    key={r.rule_name}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + idx * 0.03 }}
                    className="bg-gray-900/50 border border-gray-800/50 rounded-xl px-4 py-3 flex items-center justify-between hover:border-gray-700 transition"
                  >
                    <div className="flex items-center gap-3">
                      <FileCode2 className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-mono text-gray-200">{r.rule_name}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-400">
                        <span className="font-semibold text-white">{r.total}</span> total
                      </span>
                      <span className="text-gray-400">
                        <span className={`font-semibold ${Number(r.critical) > 0 ? 'text-red-400' : 'text-gray-500'}`}>{r.critical}</span> critical
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.section>

            {/* Recent PRs */}
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-[#111] border border-gray-800 rounded-2xl p-6 shadow-lg"
            >
              <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-5">
                <GitPullRequest className="w-5 h-5 text-blue-400" />
                Recent Pull Requests
              </h3>
              <div className="space-y-2">
                {data.recent_prs.map((pr, idx) => (
                  <motion.div
                    key={pr.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + idx * 0.03 }}
                    className="bg-gray-900/50 border border-gray-800/50 rounded-xl px-4 py-3 flex items-center justify-between hover:border-gray-700 transition"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-200">
                        <span className="text-gray-500 mr-1.5">#{pr.pr_number}</span>
                        {pr.pr_title || 'Untitled PR'}
                      </p>
                      {pr.analyzed_at && (
                        <p className="text-xs text-gray-600 mt-0.5">{new Date(pr.analyzed_at).toLocaleDateString()}</p>
                      )}
                    </div>
                    <div className={`text-base font-bold tabular-nums ${riskColor(pr.risk_score)}`}>
                      {pr.risk_score}
                      <span className="text-xs text-gray-500 font-normal ml-1">risk</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, iconColor, iconBg, value, label }: { icon: any; iconColor: string; iconBg: string; value: number; label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-[#111] border border-gray-800 rounded-2xl p-5 shadow-lg"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${iconBg}`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
      </div>
      <div className="text-2xl font-extrabold text-white tabular-nums">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </motion.div>
  );
}
