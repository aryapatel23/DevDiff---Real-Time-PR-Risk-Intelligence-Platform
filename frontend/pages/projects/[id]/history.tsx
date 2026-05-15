import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../../../lib/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Clock, AlertCircle, Search, ShieldCheck, Archive, Eye, Loader2 } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type Finding = {
  id: number;
  filename: string;
  line_number: number;
  rule_name: string;
  severity: 'critical' | 'warning' | 'info';
  confidence: number;
  message: string;
  fix_hint?: string;
  false_positive?: number;
};

type FeedbackStats = {
  total_findings: number;
  false_positive_count: number;
  low_priority_count: number;
  ignored_count: number;
  false_positive_rate: number;
  last_profile_update: string | null;
};

export default function ProjectHistoryPage() {
  const router = useRouter();
  const { id } = router.query;
  const { session, loading, apiHeaders } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [expandedPR, setExpandedPR] = useState<number | null>(null);
  const [findingsByPR, setFindingsByPR] = useState<Record<number, Finding[]>>({});
  const [loadingPR, setLoadingPR] = useState<number | null>(null);
  const [updatingFindingId, setUpdatingFindingId] = useState<number | null>(null);
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats | null>(null);

  useEffect(() => {
    if (!loading && !session) router.replace('/login');
  }, [loading, session, router]);

  useEffect(() => {
    if (!session || typeof id !== 'string') return;
    let cancelled = false;

    (async () => {
      try {
        setError('');
        const res = await fetch(`${API}/api/analytics/${id}/history`, { headers: apiHeaders() });
        const payload = await res.json().catch(() => ([]));
        if (!res.ok) throw new Error((payload && payload.error) || 'Failed to load history');
        if (!cancelled) setRows(Array.isArray(payload) ? payload : []);

        const statsRes = await fetch(`${API}/api/analytics/${id}/feedback-stats`, { headers: apiHeaders() });
        const statsPayload = await statsRes.json().catch(() => ({}));
        if (!statsRes.ok) throw new Error((statsPayload && statsPayload.error) || 'Failed to load feedback stats');
        if (!cancelled) setFeedbackStats(statsPayload);
      } catch (e: any) {
        if (!cancelled) {
          setRows([]);
          setError(e?.message || 'Failed to fetch history. Ensure backend is running on port 4000.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, id]);

  function riskColor(score: number) {
    if (score >= 70) return 'text-red-400';
    if (score >= 40) return 'text-amber-400';
    return 'text-emerald-400';
  }

  function riskBg(score: number) {
    if (score >= 70) return 'bg-red-500/10 border-red-500/20';
    if (score >= 40) return 'bg-amber-500/10 border-amber-500/20';
    return 'bg-emerald-500/10 border-emerald-500/20';
  }

  function severityStyle(severity: string) {
    if (severity === 'critical') return 'text-red-400 bg-red-500/10 border-red-500/20';
    if (severity === 'warning') return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-sky-400 bg-sky-500/10 border-sky-500/20';
  }

  async function togglePRDetails(prId: number) {
    if (expandedPR === prId) {
      setExpandedPR(null);
      return;
    }

    setExpandedPR(prId);
    if (findingsByPR[prId]) return;

    try {
      setLoadingPR(prId);
      const res = await fetch(`${API}/api/analytics/${id}/findings/${prId}`, { headers: apiHeaders() });
      const payload = await res.json().catch(() => ([]));
      if (!res.ok) throw new Error((payload && payload.error) || 'Failed to load PR findings');
      setFindingsByPR(prev => ({ ...prev, [prId]: Array.isArray(payload) ? payload : [] }));
    } catch (e: any) {
      setError(e?.message || 'Failed to load PR findings');
      setExpandedPR(null);
    } finally {
      setLoadingPR(null);
    }
  }

  async function advanceFalsePositive(prId: number, findingId: number) {
    try {
      setUpdatingFindingId(findingId);
      setError('');

      const res = await fetch(`${API}/api/analytics/findings/${findingId}/fp`, {
        method: 'POST',
        headers: apiHeaders(),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Failed to update finding feedback');

      const nextLevel = Number(payload?.false_positive || 0);

      setFindingsByPR(prev => ({
        ...prev,
        [prId]: (prev[prId] || []).map(f => (f.id === findingId ? { ...f, false_positive: nextLevel } : f)),
      }));

      if (typeof payload?.prRiskScore === 'number') {
        setRows(prev => prev.map(r => (r.id === prId ? { ...r, risk_score: payload.prRiskScore, display_score: payload.prRiskScore } : r)));
      }

      if (typeof id === 'string') {
        const statsRes = await fetch(`${API}/api/analytics/${id}/feedback-stats`, { headers: apiHeaders() });
        const statsPayload = await statsRes.json().catch(() => ({}));
        if (statsRes.ok) setFeedbackStats(statsPayload);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to update finding feedback');
    } finally {
      setUpdatingFindingId(null);
    }
  }

  function formatUpdatedAt(value: string | null) {
    if (!value) return 'not updated yet';
    try {
      return new Date(value).toLocaleString();
    } catch {
      return 'not updated yet';
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 p-6">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8 pb-6 border-b border-gray-800/50">
          <Link href={`/projects/${id}`} className="flex items-center gap-2 text-gray-500 hover:text-white transition w-fit text-sm font-medium mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to Project
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <Clock className="w-7 h-7 text-blue-400" />
            PR Analysis History
          </h1>
          <p className="text-sm text-gray-500 mt-1">{rows.length} pull request{rows.length !== 1 ? 's' : ''} analyzed</p>
        </header>

        {error && (
          <div className="mb-6 flex items-center gap-3 bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-3 text-sm text-red-200">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            {error}
          </div>
        )}

        {feedbackStats && (
          <div className="mb-6 bg-[#111] border border-gray-800/70 rounded-2xl p-4">
            <p className="text-sm text-gray-300 font-semibold">False Positive Learning</p>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-gray-900/60 border border-gray-800 rounded-lg px-3 py-2">
                <p className="text-gray-500">Feedback Marked</p>
                <p className="text-gray-200 font-semibold text-sm">{feedbackStats.false_positive_count} / {feedbackStats.total_findings}</p>
              </div>
              <div className="bg-gray-900/60 border border-gray-800 rounded-lg px-3 py-2">
                <p className="text-gray-500">Low / Ignored</p>
                <p className="text-gray-200 font-semibold text-sm">{feedbackStats.low_priority_count} / {feedbackStats.ignored_count}</p>
              </div>
              <div className="bg-gray-900/60 border border-gray-800 rounded-lg px-3 py-2">
                <p className="text-gray-500">Model Updated</p>
                <p className="text-gray-200 font-semibold text-sm">{formatUpdatedAt(feedbackStats.last_profile_update)}</p>
              </div>
            </div>
          </div>
        )}

        {rows.length === 0 && !error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center p-16 bg-[#111] border border-gray-800/60 rounded-3xl text-center shadow-2xl"
          >
            <div className="bg-blue-900/20 p-6 rounded-full mb-6 border border-blue-500/20">
              <Clock className="w-12 h-12 text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">No history yet</h2>
            <p className="text-gray-400 max-w-md mb-6">
              Analyze your first pull request to start building a history of risk assessments.
            </p>
            <Link href={`/projects/${id}`} className="bg-white text-black hover:bg-gray-200 transition px-6 py-3 rounded-xl font-semibold shadow-lg">
              Go to Project
            </Link>
          </motion.div>
        )}

        <div className="space-y-3">
          <AnimatePresence>
            {rows.map((r, idx) => {
              const isScanned = r.source_type !== 'imported';
              const score = Number(r.display_score ?? r.risk_score ?? 0);
              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className="bg-[#111] border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-2.5 rounded-xl ${isScanned ? 'bg-blue-900/20 border border-blue-500/20' : 'bg-gray-800/50 border border-gray-700/30'}`}>
                        {isScanned 
                          ? <Search className="w-5 h-5 text-blue-400" />
                          : <Archive className="w-5 h-5 text-gray-500" />
                        }
                      </div>
                      <div>
                        <p className="text-base font-semibold text-white">
                          <span className="text-gray-500 mr-1.5">#{r.pr_number}</span>
                          {r.pr_title || r.repo}
                        </p>
                        <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-2">
                          {isScanned ? (
                            <>
                              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                              Scanned in DevDiff
                            </>
                          ) : (
                            <>
                              <Archive className="w-3.5 h-3.5" />
                              Imported history
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {isScanned ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => togglePRDetails(r.id)}
                            className="inline-flex items-center gap-1.5 border border-gray-700 hover:border-gray-600 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {expandedPR === r.id ? 'Hide Analysis' : 'View Analysis'}
                          </button>
                          <div className={`inline-flex items-center gap-2 border px-3 py-1.5 rounded-lg ${riskBg(score)}`}>
                            <span className={`text-lg font-bold tabular-nums ${riskColor(score)}`}>{score}</span>
                            <span className="text-xs text-gray-400">/ 100</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-600 font-medium">N/A</span>
                      )}
                    </div>
                  </div>

                  {isScanned && expandedPR === r.id && (
                    <div className="mt-4 pt-4 border-t border-gray-800/70">
                      {loadingPR === r.id ? (
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading stored analysis...
                        </div>
                      ) : (findingsByPR[r.id]?.length || 0) === 0 ? (
                        <div className="text-sm text-gray-500">No findings stored for this PR analysis.</div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-gray-500 mb-2">Stored findings for this PR: {findingsByPR[r.id].length}</p>
                          {findingsByPR[r.id].map(f => (
                            <div key={f.id} className={`border rounded-xl p-3 ${f.false_positive ? 'bg-gray-950/70 border-gray-800/70 opacity-80' : 'bg-gray-900/50 border-gray-800'}`}>
                              <div className="flex items-center justify-between gap-3 mb-2">
                                <div className="text-xs text-gray-400 font-mono truncate">{f.filename}:{f.line_number}</div>
                                <div className="flex items-center gap-2">
                                  {Number(f.false_positive || 0) === 1 ? (
                                    <span className="text-[11px] border rounded px-2 py-0.5 font-semibold uppercase text-amber-300 bg-amber-500/10 border-amber-500/30">
                                      Low Priority
                                    </span>
                                  ) : null}
                                  {Number(f.false_positive || 0) >= 2 ? (
                                    <span className="text-[11px] border rounded px-2 py-0.5 font-semibold uppercase text-gray-300 bg-gray-800/80 border-gray-700">
                                      Ignored
                                    </span>
                                  ) : null}
                                  <span className={`text-[11px] border rounded px-2 py-0.5 font-semibold uppercase ${severityStyle(f.severity)}`}>
                                    {f.severity}
                                  </span>
                                </div>
                              </div>
                              <p className="text-sm text-gray-200">{f.message}</p>
                              <p className="text-xs text-gray-500 mt-1">{f.rule_name} · confidence {Math.round(Number(f.confidence || 0))}%</p>
                              {f.fix_hint && <p className="text-xs text-gray-400 mt-2">Fix: {f.fix_hint}</p>}
                              {Number(f.false_positive || 0) < 2 ? (
                                <div className="mt-3">
                                  <button
                                    onClick={() => advanceFalsePositive(r.id, f.id)}
                                    disabled={updatingFindingId === f.id}
                                    className="text-xs border border-gray-700 hover:border-gray-600 disabled:opacity-50 text-gray-300 hover:text-white px-2.5 py-1 rounded-md transition"
                                  >
                                    {updatingFindingId === f.id ? 'Saving...' : Number(f.false_positive || 0) === 1 ? 'Mark Again to Ignore' : 'Mark as False Positive'}
                                  </button>
                                </div>
                              ) : (
                                <p className="mt-3 text-xs text-gray-500">Ignored in future scans for this same file + rule.</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
