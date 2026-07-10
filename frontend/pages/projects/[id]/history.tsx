import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../../../lib/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Clock, AlertCircle, Search, ShieldCheck, Archive, Eye, Loader2, X } from 'lucide-react';

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
  const [initialLoading, setInitialLoading] = useState(true);

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
          setError(e?.message || 'Failed to fetch history.');
        }
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [session, id]);

  function riskBadge(score: number) {
    if (score >= 70) return 'badge-critical';
    if (score >= 40) return 'badge-high';
    return 'badge-low';
  }

  function severityBadge(severity: string) {
    if (severity === 'critical') return 'badge-critical';
    if (severity === 'warning') return 'badge-high';
    return 'badge-info';
  }

  async function togglePRDetails(prId: number) {
    if (expandedPR === prId) { setExpandedPR(null); return; }
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
    if (!value) return 'not yet';
    try { return new Date(value).toLocaleString(); } catch { return 'not yet'; }
  }

  return (
    <div className="p-6 md:p-8 max-w-[1000px] mx-auto">
      <header className="mb-8">
        <Link href={`/projects/${id}`} className="inline-flex items-center gap-2 text-text-dim hover:text-accent transition text-sm font-medium mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Project
        </Link>
        <h1 className="text-2xl font-extrabold text-text-bright flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center">
            <Clock className="w-5 h-5 text-info" />
          </div>
          PR Analysis History
        </h1>
        <p className="text-sm text-text-dim mt-1">{rows.length} pull request{rows.length !== 1 ? 's' : ''} analyzed</p>
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

      {/* Loading skeleton */}
      {initialLoading && !error && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="glow-card p-5">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-surface-2 animate-pulse" />
                <div className="flex-1">
                  <div className="h-4 w-48 bg-surface-2 rounded animate-pulse mb-2" />
                  <div className="h-3 w-32 bg-surface-2 rounded animate-pulse" />
                </div>
                <div className="h-6 w-16 bg-surface-2 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}

      {feedbackStats && !initialLoading && (
        <div className="mb-6 glow-card p-5">
          <p className="text-sm text-text-bright font-semibold mb-3">False Positive Learning</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-surface-2/50 rounded-xl px-4 py-3 border border-border-faint">
              <p className="text-xs text-text-dim">Feedback Marked</p>
              <p className="text-sm font-bold text-text-bright">{feedbackStats.false_positive_count} / {feedbackStats.total_findings}</p>
            </div>
            <div className="bg-surface-2/50 rounded-xl px-4 py-3 border border-border-faint">
              <p className="text-xs text-text-dim">Low / Ignored</p>
              <p className="text-sm font-bold text-text-bright">{feedbackStats.low_priority_count} / {feedbackStats.ignored_count}</p>
            </div>
            <div className="bg-surface-2/50 rounded-xl px-4 py-3 border border-border-faint">
              <p className="text-xs text-text-dim">Model Updated</p>
              <p className="text-sm font-bold text-text-bright">{formatUpdatedAt(feedbackStats.last_profile_update)}</p>
            </div>
          </div>
        </div>
      )}

      {rows.length === 0 && !error && !initialLoading && (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center p-16 glow-card text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-info/10 flex items-center justify-center mb-5">
            <Clock className="w-8 h-8 text-info" />
          </div>
          <h2 className="text-xl font-bold text-text-bright mb-2">No history yet</h2>
          <p className="text-text-dim max-w-md mb-6 text-sm">Analyze your first pull request to start building a history.</p>
          <Link href={`/projects/${id}`} className="btn-primary">Go to Project</Link>
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
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="glow-card p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isScanned ? 'bg-accent/10 border border-accent/20' : 'bg-surface-3 border border-border-faint'}`}>
                      {isScanned ? <Search className="w-5 h-5 text-accent" /> : <Archive className="w-5 h-5 text-text-dim" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-bright">
                        <span className="text-text-dim mr-1.5">#{r.pr_number}</span>
                        {r.pr_title || r.repo}
                      </p>
                      <p className="text-xs text-text-dim mt-0.5 flex items-center gap-1.5">
                        {isScanned ? (
                          <><ShieldCheck className="w-3 h-3 text-accent" /> Scanned in DevDiff</>
                        ) : (
                          <><Archive className="w-3 h-3" /> Imported history</>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isScanned && (
                      <>
                        <button
                          onClick={() => togglePRDetails(r.id)}
                          className="badge bg-surface-2 text-text-dim border-border-subtle hover:border-border-default hover:text-text-normal transition-all cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          {expandedPR === r.id ? 'Hide' : 'View'}
                        </button>
                        <span className={`badge ${riskBadge(score)}`}>{score}/100</span>
                      </>
                    )}
                    {!isScanned && <span className="text-xs text-text-dim">N/A</span>}
                  </div>
                </div>

                {isScanned && expandedPR === r.id && (
                  <div className="mt-4 pt-4 border-t border-border-faint">
                    {loadingPR === r.id ? (
                      <div className="flex items-center gap-2 text-sm text-text-dim">
                        <Loader2 className="w-4 h-4 animate-spin text-accent" /> Loading analysis...
                      </div>
                    ) : (findingsByPR[r.id]?.length || 0) === 0 ? (
                      <div className="text-sm text-text-dim">No findings stored for this PR.</div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-text-dim mb-2">{findingsByPR[r.id].length} findings</p>
                        {findingsByPR[r.id].map(f => (
                          <div key={f.id} className={`border rounded-xl p-3 ${f.false_positive ? 'bg-surface-2/30 border-border-faint opacity-70' : 'bg-surface-2/50 border-border-subtle'}`}>
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <div className="text-xs text-text-dim font-mono truncate">{f.filename}:{f.line_number}</div>
                              <div className="flex items-center gap-2">
                                {Number(f.false_positive || 0) === 1 && <span className="badge badge-medium">Low</span>}
                                {Number(f.false_positive || 0) >= 2 && <span className="badge bg-surface-3 text-text-dim border-border-subtle">Ignored</span>}
                                <span className={`badge ${severityBadge(f.severity)}`}>{f.severity}</span>
                              </div>
                            </div>
                            <p className="text-sm text-text-normal">{f.message}</p>
                            <p className="text-xs text-text-dim mt-1">{f.rule_name} · {Math.round(Number(f.confidence || 0))}% confidence</p>
                            {f.fix_hint && <p className="text-xs text-text-dim mt-2">Fix: {f.fix_hint}</p>}
                            {Number(f.false_positive || 0) < 2 ? (
                              <button
                                onClick={() => advanceFalsePositive(r.id, f.id)}
                                disabled={updatingFindingId === f.id}
                                className="mt-3 text-xs px-3 py-1.5 rounded-lg border border-border-subtle hover:border-border-default text-text-dim hover:text-text-normal transition disabled:opacity-50"
                              >
                                {updatingFindingId === f.id ? 'Saving...' : Number(f.false_positive || 0) === 1 ? 'Mark Again to Ignore' : 'Mark as False Positive'}
                              </button>
                            ) : (
                              <p className="mt-3 text-xs text-text-dim">Ignored in future scans.</p>
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
  );
}
