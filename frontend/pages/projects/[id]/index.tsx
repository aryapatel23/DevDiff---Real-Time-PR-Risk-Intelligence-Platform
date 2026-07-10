import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../../../lib/auth';
import { connectWS } from '../../../lib/websocket';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Search,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  FileCode2,
  AlertCircle,
  ExternalLink,
  GitPullRequest,
  Clock,
  BarChart3,
  Flame,
  Users,
  ChevronDown,
  Lightbulb,
  Lock,
  Zap,
  UserPlus,
  CheckCircle2,
  Github,
  X,
  Trash2,
} from 'lucide-react';

type Project = {
  id: string;
  name: string;
  github_repo: string;
  is_private: boolean;
  import_status: string;
  import_count?: number;
  analysis_status?: string;
  analysis_count?: number;
  analysis_total?: number;
};

type Finding = {
  id?: number;
  filename: string;
  line_number: number;
  rule_name: string;
  severity: 'critical' | 'warning' | 'info' | 'suggestion';
  confidence: number;
  message: string;
  fix_hint?: string;
  isDangerZone?: boolean;
  source?: 'rule' | 'llm';
  false_positive?: number;
};

type PRMeta = {
  title: string;
  author: string;
  repo: string;
  prNumber: number;
  prUrl: string;
  files: Array<{ filename: string; additions?: number; deletions?: number; status?: string }>;
};

type AnalyzeSummary = {
  prId: number;
  totalFindings: number;
  riskScore: number;
  author: string;
};

type FindingFilter = 'all' | 'critical' | 'warning' | 'info' | 'low' | 'ignored';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 70 ? 'var(--critical)' : score >= 40 ? 'var(--high)' : 'var(--low)';
  const label = score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low';

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="score-ring">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-3)" strokeWidth={5} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          className="score-ring-fill"
        />
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--text-bright)"
          fontSize={size * 0.22}
          fontWeight="700"
          style={{ transform: 'rotate(90deg)', transformOrigin: '50% 50%' }}
        >
          {score}
        </text>
      </svg>
      <span className="text-xs font-semibold" style={{ color }}>{label} Risk</span>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    critical: 'badge-critical',
    warning: 'badge-high',
    info: 'badge-info',
    suggestion: 'badge-medium',
  };
  const icons: Record<string, any> = {
    critical: ShieldAlert,
    warning: AlertCircle,
    info: Zap,
    suggestion: Lightbulb,
  };
  const Icon = icons[severity] || Zap;
  return (
    <span className={`badge ${map[severity] || 'badge-info'}`}>
      <Icon className="w-3 h-3" />
      {severity}
    </span>
  );
}

export default function ProjectDetailPage() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : '';
  const { session, loading, apiHeaders } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [prUrl, setPrUrl] = useState('');
  const [ticketUrl, setTicketUrl] = useState('');
  const [findings, setFindings] = useState<Finding[]>([]);
  const [prMeta, setPrMeta] = useState<PRMeta | null>(null);
  const [summary, setSummary] = useState<AnalyzeSummary | null>(null);
  const [newUserMsg, setNewUserMsg] = useState('');
  const [error, setError] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [updatingFindingId, setUpdatingFindingId] = useState<number | null>(null);
  const [findingFilter, setFindingFilter] = useState<FindingFilter>('all');
  const [phaseText, setPhaseText] = useState('Idle');
  const [riskScore, setRiskScore] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!loading && !session) router.replace('/login');
  }, [loading, session, router]);

  useEffect(() => {
    if (!id || !session) return;
    fetch(`${API}/api/projects/${id}`, { headers: apiHeaders() })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Failed to load project');
        setProject(d);
      })
      .catch(e => setError(e.message));
  }, [id, session]);

  // Poll project status while import or analysis is in progress
  useEffect(() => {
    if (!id || !session || !project) return;
    const isImporting = project.import_status === 'running' || project.import_status === 'pending';
    const isAnalyzingHist = project.analysis_status === 'running';
    if (!isImporting && !isAnalyzingHist) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/projects/${id}`, { headers: apiHeaders() });
        const data = await res.json();
        if (res.ok) setProject(data);
      } catch {}
    }, 2000);

    return () => clearInterval(interval);
  }, [id, session, project?.import_status, project?.analysis_status]);

  async function analyze() {
    if (!prUrl.trim() || !project) return;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsAnalyzing(true);
    setPhaseText('Starting analysis...');
    setError('');
    setFindings([]);
    setPrMeta(null);
    setSummary(null);
    setNewUserMsg('');
    setRiskScore(0);

    try {
      const res = await fetch(`${API}/api/analyze`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ prUrl: prUrl.trim(), projectId: project.id, ticketUrl: ticketUrl.trim() || undefined }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Analyze failed');

      wsRef.current = connectWS(body.jobId, (msg: any) => {
        if (msg.event === 'pr_meta') {
          setPrMeta(msg.data || null);
          setPhaseText('PR loaded');
        }
        if (msg.event === 'code_loaded') setPhaseText('Running rule checks...');
        if (msg.event === 'logic_review_start') setPhaseText('Running logic review...');
        if (msg.event === 'new_user') setNewUserMsg(msg.data?.message || '');
        if (msg.event === 'intent_warning') setPhaseText('Intent mismatch detected');
        if (msg.event === 'finding') {
          setFindings(prev => [...prev, msg.data]);
          setPhaseText('Streaming findings...');
          if (msg.data?.severity === 'critical') setRiskScore(prev => Math.min(100, prev + 12));
          else if (msg.data?.severity === 'warning') setRiskScore(prev => Math.min(100, prev + 4));
        }
        if (msg.event === 'logic_finding') {
          const logicFinding: Finding = {
            filename: msg.data?.filename || 'unknown-file',
            line_number: Number(msg.data?.line || 0),
            rule_name: `logic:${msg.data?.functionName || 'review'}`,
            severity: msg.data?.severity || 'warning',
            confidence: Number(msg.data?.confidence || 70),
            message: msg.data?.message || 'Potential logic issue detected',
            fix_hint: msg.data?.fix || '',
            source: 'llm',
          };
          setFindings(prev => [...prev, logicFinding]);
          setPhaseText('Streaming logic findings...');
          if (logicFinding.severity === 'critical') setRiskScore(prev => Math.min(100, prev + 12));
          else if (logicFinding.severity === 'warning') setRiskScore(prev => Math.min(100, prev + 4));
        }
        if (msg.event === 'logic_review_complete') setPhaseText('Logic review completed');
        if (msg.event === 'complete') {
          setSummary(msg.data || null);
          setRiskScore(Number(msg.data?.riskScore || 0));
          setPhaseText('Complete');
        }
        if (msg.event === 'error') {
          setPhaseText('Error');
          setError(msg.data?.message || 'Analyze failed');
        }
      }, () => {
        setIsAnalyzing(false);
      });
    } catch (e: any) {
      setIsAnalyzing(false);
      setPhaseText('Error');
      setError(e.message || 'Analyze failed');
    }
  }

  async function deleteProject() {
    if (!project || isDeleting) return;
    const confirmed = window.confirm(`Delete project "${project.name}"? This cannot be undone.`);
    if (!confirmed) return;
    setIsDeleting(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/projects/${project.id}`, {
        method: 'DELETE',
        headers: apiHeaders(),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to delete project');
      router.replace('/dashboard');
    } catch (e: any) {
      setError(e?.message || 'Failed to delete project');
      setIsDeleting(false);
    }
  }

  async function advanceFindingSuppression(findingId: number) {
    if (!project) return;
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
      setFindings(prev => prev.map(f => {
        if (f.id !== findingId) return f;
        const nextSeverity = nextLevel === 1 ? 'info' : f.severity;
        return { ...f, false_positive: nextLevel, severity: nextSeverity };
      }));
      if (typeof payload?.prRiskScore === 'number') {
        setRiskScore(payload.prRiskScore);
        setSummary(prev => (prev ? { ...prev, riskScore: payload.prRiskScore } : prev));
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to update finding feedback');
    } finally {
      setUpdatingFindingId(null);
    }
  }

  useEffect(() => {
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, []);

  const grouped = useMemo(() => {
    const byFilter = findings.filter((f) => {
      const level = Number(f.false_positive || 0);
      if (findingFilter === 'ignored') return level >= 2;
      if (findingFilter === 'low') return level === 1;
      if (findingFilter === 'all') return level <= 1;
      return level <= 1 && f.severity === findingFilter;
    });
    const map: Record<string, Finding[]> = {};
    for (const f of byFilter) {
      if (!map[f.filename]) map[f.filename] = [];
      map[f.filename].push(f);
    }
    return map;
  }, [findings, findingFilter]);

  const criticalCount = findings.filter(f => Number(f.false_positive || 0) <= 1 && f.severity === 'critical').length;
  const warningCount = findings.filter(f => Number(f.false_positive || 0) <= 1 && f.severity === 'warning').length;
  const infoCount = findings.filter(f => Number(f.false_positive || 0) <= 1 && f.severity === 'info').length;
  const lowPriorityCount = findings.filter(f => Number(f.false_positive || 0) === 1).length;
  const ignoredCount = findings.filter(f => Number(f.false_positive || 0) >= 2).length;

  if (loading || !session) return <div className="min-h-screen bg-void" />;

  const isImporting = project?.import_status === 'running' || project?.import_status === 'pending';
  const isAnalyzingHistory = project?.analysis_status === 'running';
  const showProgress = isImporting || isAnalyzingHistory;
  const isBusy = showProgress || isAnalyzing;

  return (
    <div className="p-6 md:p-8 max-w-[1200px] mx-auto">
      {/* Loading skeleton while project data loads */}
      {!project && !error && (
        <div className="space-y-6">
          <div className="h-8 w-48 bg-surface-2 rounded-lg animate-pulse" />
          <div className="glow-card p-6">
            <div className="h-6 w-64 bg-surface-2 rounded animate-pulse mb-4" />
            <div className="h-4 w-full bg-surface-2 rounded animate-pulse" />
          </div>
        </div>
      )}

      {/* Import/Analysis Progress Popup */}
      <AnimatePresence>
        {showProgress && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="mb-6 glow-card glow-border p-6"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                <Loader2 className="w-6 h-6 text-accent animate-spin" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-text-bright mb-1">
                  {isImporting ? 'Importing merged PRs...' : 'Analyzing historical PRs...'}
                </h3>
                <p className="text-sm text-text-dim mb-3">
                  {isImporting
                    ? `Fetching your merged PRs from GitHub (${project?.import_count || 0}/30)`
                    : `Running security analysis on past PRs (${project?.analysis_count || 0}/${project?.analysis_total || 0})`
                  }
                </p>
                {/* Progress bar */}
                <div className="h-2 rounded-full bg-surface-3 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-accent"
                    initial={{ width: 0 }}
                    animate={{
                      width: isImporting
                        ? `${((project?.import_count || 0) / 30) * 100}%`
                        : `${((project?.analysis_count || 0) / (project?.analysis_total || 1)) * 100}%`
                    }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-text-dim">
                  <span>{isImporting ? 'Importing...' : 'Analyzing...'}</span>
                  <span>
                    {isImporting
                      ? `${project?.import_count || 0} of 30 PRs`
                      : `${project?.analysis_count || 0} of ${project?.analysis_total || 0} PRs`
                    }
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Analysis Complete Banner */}
      {!showProgress && project?.analysis_status === 'done' && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 bg-safe/10 border border-safe/20 rounded-xl px-5 py-3 flex items-center gap-3"
        >
          <CheckCircle2 className="w-5 h-5 text-safe shrink-0" />
          <span className="text-sm text-safe font-medium">
            Historical analysis complete — {project.analysis_count || 0} PRs analyzed. You can now check individual PRs or view the scorecard.
          </span>
        </motion.div>
      )}

      {/* Header */}
      <header className="mb-8">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-text-dim hover:text-accent transition text-sm font-medium mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
              <GitPullRequest className="w-6 h-6 text-accent" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold text-text-bright">{project?.name || 'Project'}</h1>
                {project?.is_private && <Lock className="w-4 h-4 text-text-dim" />}
              </div>
              <p className="text-sm text-text-dim font-mono flex items-center gap-1.5 mt-0.5">
                <Github className="w-3.5 h-3.5" />
                {project?.github_repo}
              </p>
            </div>
          </div>
          <button
            onClick={deleteProject}
            disabled={isDeleting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-critical/80 hover:text-critical hover:bg-critical/10 border border-critical/20 transition-all disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </header>

      {/* Analysis Panel */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`glow-card p-6 mb-6 ${isBusy ? 'opacity-60' : ''}`}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-text-bright flex items-center gap-2">
            <Search className="w-4 h-4 text-accent" />
            Analyze Pull Request
          </h2>
          <div className="flex items-center gap-2">
            {isBusy ? (
              <span className="badge badge-accent">
                <Loader2 className="w-3 h-3 animate-spin" />
                {isImporting ? 'Importing...' : isAnalyzingHistory ? 'Analyzing...' : phaseText}
              </span>
            ) : isAnalyzing ? (
              <span className="badge badge-accent">
                <Loader2 className="w-3 h-3 animate-spin" />
                {phaseText}
              </span>
            ) : (
              <span className="badge badge-info">
                <Clock className="w-3 h-3" />
                {phaseText}
              </span>
            )}
          </div>
        </div>

        {isBusy ? (
          <div className="bg-surface-2/50 border border-border-faint rounded-xl px-5 py-4 text-sm text-text-dim">
            {isImporting && (
              <p>Importing merged PRs from GitHub. You can analyze individual PRs once the import is complete.</p>
            )}
            {isAnalyzingHistory && !isImporting && (
              <p>Historical analysis is running in the background. You can analyze individual PRs once it&apos;s complete.</p>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs text-text-dim mb-4">
              PRs must belong to <span className="text-text-normal font-mono">{project?.github_repo}</span>
            </p>

            <div className="flex gap-3 mb-3">
              <input
                value={prUrl}
                onChange={e => setPrUrl(e.target.value)}
                placeholder="https://github.com/owner/repo/pull/123"
                className="input-field flex-1 font-mono text-sm"
                disabled={isBusy}
              />
              <button
                onClick={analyze}
                disabled={isAnalyzing || isBusy || !prUrl.trim()}
                className="btn-primary flex items-center gap-2 text-sm shrink-0"
              >
                {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {isAnalyzing ? 'Analyzing...' : 'Analyze'}
              </button>
            </div>

            <input
              value={ticketUrl}
              onChange={e => setTicketUrl(e.target.value)}
              placeholder="Optional: Ticket or issue URL for intent validation"
              className="input-field text-sm mb-5"
              disabled={isBusy}
            />
          </>
        )}

        {/* Risk Score Ring */}
        {(isAnalyzing || riskScore > 0) && (
          <div className="flex items-center gap-6 p-4 rounded-xl bg-surface-2/50 border border-border-faint">
            <ScoreRing score={riskScore} />
            <div className="flex-1">
              <div className="h-2 rounded-full bg-surface-3 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${
                    riskScore >= 70 ? 'bg-critical' : riskScore >= 40 ? 'bg-high' : 'bg-safe'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${riskScore}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-text-dim">
                <span>0</span>
                <span>Risk Score</span>
                <span>100</span>
              </div>
            </div>
          </div>
        )}

        {/* Check Another PR */}
        {!isAnalyzing && phaseText === 'Complete' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 pt-4 border-t border-border-faint">
            <button
              onClick={() => {
                setPrUrl(''); setTicketUrl(''); setFindings([]); setPrMeta(null);
                setSummary(null); setNewUserMsg(''); setError(''); setRiskScore(0); setPhaseText('Idle');
              }}
              className="btn-ghost w-full flex items-center justify-center gap-2 text-sm"
            >
              <GitPullRequest className="w-4 h-4" />
              Check Another PR
            </button>
          </motion.div>
        )}
      </motion.div>

      {/* Notifications */}
      <AnimatePresence>
        {newUserMsg && (
          <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4 flex items-center gap-3 bg-info/10 border border-info/20 rounded-xl px-4 py-3 text-sm text-info"
          >
            <UserPlus className="w-4 h-4 shrink-0" />
            {newUserMsg}
          </motion.div>
        )}
        {error && (
          <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4 flex items-center gap-3 bg-critical/10 border border-critical/20 rounded-xl px-4 py-3 text-sm text-critical"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError('')} className="text-critical/60 hover:text-critical">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PR Meta */}
      <AnimatePresence>
        {prMeta && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 glow-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-text-bright flex items-center gap-2">
                  <GitPullRequest className="w-4 h-4 text-accent" />
                  PR #{prMeta.prNumber}: {prMeta.title || 'Untitled PR'}
                </h3>
                <div className="flex items-center gap-4 mt-2 text-sm text-text-dim">
                  <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {prMeta.author}</span>
                  <span className="flex items-center gap-1.5"><FileCode2 className="w-3.5 h-3.5" /> {prMeta.files?.length || 0} files</span>
                </div>
              </div>
              {prMeta.prUrl && (
                <a href={prMeta.prUrl} target="_blank" rel="noreferrer" className="p-2 rounded-lg text-text-dim hover:text-accent hover:bg-accent/10 transition-all">
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clean PR */}
      {summary && findings.length === 0 && !error && (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
          className="mb-8 flex flex-col items-center justify-center p-12 glow-card text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-low/10 border border-low/20 flex items-center justify-center mb-5">
            <ShieldCheck className="w-8 h-8 text-safe" />
          </div>
          <h3 className="text-xl font-bold text-text-bright mb-2">All Clear!</h3>
          <p className="text-text-dim max-w-md text-sm">No security risks or code quality issues were detected. Great work!</p>
        </motion.div>
      )}

      {/* Findings */}
      {Object.keys(grouped).length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-text-bright flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-critical" />
              Findings
            </h2>
            <div className="flex items-center gap-2">
              {criticalCount > 0 && <span className="badge badge-critical">{criticalCount} Critical</span>}
              {warningCount > 0 && <span className="badge badge-high">{warningCount} Warnings</span>}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex flex-wrap gap-2 mb-5">
            {[
              { key: 'all', label: 'All', count: criticalCount + warningCount + infoCount },
              { key: 'critical', label: 'Critical', count: criticalCount },
              { key: 'warning', label: 'Warnings', count: warningCount },
              { key: 'info', label: 'Info', count: infoCount },
              { key: 'low', label: 'Low Priority', count: lowPriorityCount },
              { key: 'ignored', label: 'Ignored', count: ignoredCount },
            ].map(item => (
              <button
                key={item.key}
                onClick={() => setFindingFilter(item.key as FindingFilter)}
                className={`badge transition-all ${
                  findingFilter === item.key
                    ? 'badge-accent'
                    : 'bg-surface-2 text-text-dim border-border-subtle hover:border-border-default hover:text-text-normal'
                }`}
              >
                {item.label} ({item.count})
              </button>
            ))}
          </div>

          {/* Grouped findings */}
          <div className="space-y-4">
            <AnimatePresence>
              {Object.entries(grouped).map(([filename, rows]) => {
                const dangerZone = rows.length >= 5;
                return (
                  <motion.div
                    key={filename}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`glow-card overflow-hidden ${dangerZone ? 'border-critical/30' : ''}`}
                  >
                    {/* File header */}
                    <div className={`flex items-center justify-between px-5 py-3 ${dangerZone ? 'bg-critical/5' : 'bg-surface-2/50'}`}>
                      <div className="flex items-center gap-3">
                        <FileCode2 className={`w-4 h-4 ${dangerZone ? 'text-critical' : 'text-text-dim'}`} />
                        <p className="text-sm font-mono text-text-bright">{filename}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text-dim">{rows.length} issue{rows.length > 1 ? 's' : ''}</span>
                        {dangerZone && <span className="badge badge-critical">DANGER ZONE</span>}
                      </div>
                    </div>

                    {/* Findings list */}
                    <div className="divide-y divide-border-faint">
                      {rows.map((f, idx) => (
                        <div
                          key={`${filename}-${idx}`}
                          className={`px-5 py-4 hover:bg-surface-2/30 transition ${
                            f.severity === 'critical' && Number(f.false_positive || 0) === 0
                              ? 'border-l-2 border-l-critical bg-critical/3'
                              : ''
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <SeverityBadge severity={f.severity} />
                            {Number(f.false_positive || 0) === 1 && (
                              <span className="badge badge-medium">LOW PRIORITY</span>
                            )}
                            {Number(f.false_positive || 0) >= 2 && (
                              <span className="badge bg-surface-3 text-text-dim border-border-subtle">IGNORED</span>
                            )}
                            <span className="text-xs text-text-dim font-mono bg-surface-2 px-2 py-0.5 rounded">{f.rule_name}</span>
                            <span className="text-xs text-text-dim">L{f.line_number}</span>
                            <span className="ml-auto text-xs font-semibold text-text-dim tabular-nums">{Math.round(f.confidence)}%</span>
                          </div>
                          <p className="text-sm text-text-normal leading-relaxed">{f.message}</p>

                          {/* Actions */}
                          <div className="flex items-center gap-3 mt-3">
                            {typeof f.id === 'number' && Number(f.false_positive || 0) < 2 && (
                              <button
                                onClick={() => advanceFindingSuppression(f.id as number)}
                                disabled={updatingFindingId === f.id}
                                className="text-xs px-3 py-1.5 rounded-lg border border-border-subtle hover:border-border-default text-text-dim hover:text-text-normal transition disabled:opacity-50"
                              >
                                {updatingFindingId === f.id ? 'Saving...' : Number(f.false_positive || 0) === 1 ? 'Mark Again to Ignore' : 'Mark as False Positive'}
                              </button>
                            )}
                            {f.fix_hint && (
                              <details className="group">
                                <summary className="text-xs text-accent cursor-pointer hover:text-accent-dim transition flex items-center gap-1.5">
                                  <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" />
                                  Fix suggestion
                                </summary>
                                <div className="mt-2 bg-surface-2 border border-border-faint rounded-lg px-4 py-3 text-xs text-text-code leading-relaxed font-mono">
                                  {f.fix_hint}
                                </div>
                              </details>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Summary */}
      {summary && findings.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-8 glow-card p-5">
          <h3 className="text-base font-bold text-text-bright flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-4 h-4 text-safe" />
            Analysis Complete
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-surface-2/50 rounded-xl p-4 text-center border border-border-faint">
              <p className="text-2xl font-bold text-text-bright">{summary.totalFindings}</p>
              <p className="text-xs text-text-dim mt-1">Total Findings</p>
            </div>
            <div className="bg-surface-2/50 rounded-xl p-4 text-center border border-border-faint">
              <p className={`text-2xl font-bold ${summary.riskScore >= 70 ? 'text-critical' : summary.riskScore >= 40 ? 'text-high' : 'text-safe'}`}>
                {summary.riskScore}/100
              </p>
              <p className="text-xs text-text-dim mt-1">Risk Score</p>
            </div>
            <div className="bg-surface-2/50 rounded-xl p-4 text-center border border-border-faint">
              <p className="text-2xl font-bold text-text-bright">{summary.author}</p>
              <p className="text-xs text-text-dim mt-1">Author</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Navigation Cards */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-3 gap-4">
        <Link href={`/projects/${id}/history`} className="glow-card group flex flex-col items-center gap-3 p-5 text-center hover:border-info/30 transition-all">
          <div className="w-12 h-12 rounded-xl bg-info/10 flex items-center justify-center group-hover:bg-info/15 transition-colors">
            <Clock className="w-5 h-5 text-info" />
          </div>
          <span className="text-sm font-semibold text-text-bright">History</span>
          <span className="text-xs text-text-dim">Past analyses</span>
        </Link>
        <Link href={`/projects/${id}/scorecard`} className="glow-card group flex flex-col items-center gap-3 p-5 text-center hover:border-safe/30 transition-all">
          <div className="w-12 h-12 rounded-xl bg-safe/10 flex items-center justify-center group-hover:bg-safe/15 transition-colors">
            <BarChart3 className="w-5 h-5 text-safe" />
          </div>
          <span className="text-sm font-semibold text-text-bright">Scorecard</span>
          <span className="text-xs text-text-dim">Team health</span>
        </Link>
        <Link href={`/projects/${id}/heatmap`} className="glow-card group flex flex-col items-center gap-3 p-5 text-center hover:border-high/30 transition-all">
          <div className="w-12 h-12 rounded-xl bg-high/10 flex items-center justify-center group-hover:bg-high/15 transition-colors">
            <Flame className="w-5 h-5 text-high" />
          </div>
          <span className="text-sm font-semibold text-text-bright">Heatmap</span>
          <span className="text-xs text-text-dim">Bug density</span>
        </Link>
      </motion.div>
    </div>
  );
}
