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
} from 'lucide-react';

type Project = {
  id: string;
  name: string;
  github_repo: string;
  is_private: boolean;
  import_status: string;
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

function RiskMeter({ score }: { score: number }) {
  const color = score >= 70 ? 'from-red-500 to-red-600' : score >= 40 ? 'from-amber-500 to-amber-600' : 'from-emerald-500 to-emerald-600';
  const label = score >= 70 ? 'High Risk' : score >= 40 ? 'Medium Risk' : 'Low Risk';
  const textColor = score >= 70 ? 'text-red-400' : score >= 40 ? 'text-amber-400' : 'text-emerald-400';
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1 bg-gray-800 rounded-full h-2.5 overflow-hidden">
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <span className={`text-sm font-bold ${textColor} tabular-nums min-w-[70px] text-right`}>{score}/100</span>
      <span className={`text-xs font-medium ${textColor} hidden sm:inline`}>{label}</span>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const config: Record<string, { cls: string; icon: any }> = {
    critical: { cls: 'bg-red-500/10 text-red-400 border-red-500/30', icon: ShieldAlert },
    warning: { cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30', icon: AlertCircle },
    info: { cls: 'bg-sky-500/10 text-sky-400 border-sky-500/30', icon: Zap },
    suggestion: { cls: 'bg-gray-500/10 text-gray-400 border-gray-500/30', icon: Lightbulb },
  };
  const c = config[severity] || config.info;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold uppercase tracking-wide ${c.cls}`}>
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
        if (msg.event === 'code_loaded') {
          setPhaseText('Running rule checks...');
        }
        if (msg.event === 'logic_review_start') {
          setPhaseText('Running logic review...');
        }
        if (msg.event === 'new_user') setNewUserMsg(msg.data?.message || '');
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
        if (msg.event === 'logic_review_complete') {
          setPhaseText('Logic review completed');
        }
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
    const confirmed = window.confirm(`Delete project \"${project.name}\"? This cannot be undone.`);
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
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
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

  if (loading || !session) return <div className="min-h-screen bg-[#0a0a0a]" />;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-10 pb-6 border-b border-gray-800/50">
          <Link href="/dashboard" className="flex items-center gap-2 text-gray-500 hover:text-white transition w-fit text-sm font-medium mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-blue-900/30 p-3 rounded-2xl border border-blue-500/20">
                <GitPullRequest className="w-7 h-7 text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-extrabold tracking-tight text-white">{project?.name || 'Project'}</h1>
                  {project?.is_private && (
                    <span className="bg-gray-800 border border-gray-700 text-gray-400 p-1.5 rounded-lg" title="Private Repository">
                      <Lock className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 font-mono flex items-center gap-1.5 mt-1">
                  <Github className="w-3.5 h-3.5" />
                  {project?.github_repo}
                </p>
              </div>
            </div>
            <button
              onClick={deleteProject}
              disabled={isDeleting}
              className="bg-red-600/90 hover:bg-red-600 transition px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Delete Project'}
            </button>
          </div>
        </header>

        {/* Analysis Panel */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#111] border border-gray-800 rounded-3xl p-6 mb-8 shadow-2xl"
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-500" />
              Analyze Pull Request
            </h2>
            <div className="flex items-center gap-2">
              {isAnalyzing ? (
                <span className="flex items-center gap-2 text-xs font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-lg">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {phaseText}
                </span>
              ) : (
                <span className="flex items-center gap-2 text-xs font-medium text-gray-500 bg-gray-800 px-3 py-1.5 rounded-lg">
                  <Clock className="w-3.5 h-3.5" />
                  {phaseText}
                </span>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-500 mb-4">
            PRs must belong to <span className="text-gray-300 font-mono">{project?.github_repo}</span>
          </p>

          <div className="flex gap-3 mb-3">
            <input
              value={prUrl}
              onChange={e => setPrUrl(e.target.value)}
              placeholder="https://github.com/owner/repo/pull/123"
              className="flex-1 bg-gray-900 border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition rounded-xl px-4 py-3 text-sm font-mono"
            />
            <button
              onClick={analyze}
              disabled={isAnalyzing || !prUrl.trim()}
              className="bg-blue-600 hover:bg-blue-500 transition shadow-lg shadow-blue-900/20 px-6 py-3 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
            >
              {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {isAnalyzing ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>

          <input
            value={ticketUrl}
            onChange={e => setTicketUrl(e.target.value)}
            placeholder="Optional: Ticket or issue URL for intent validation"
            className="w-full bg-gray-900 border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition rounded-xl px-4 py-3 text-sm mb-4"
          />

          <RiskMeter score={riskScore} />

          {/* Check Another PR button */}
          {!isAnalyzing && phaseText === 'Complete' && (
            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="mt-4 pt-4 border-t border-gray-800/50">
              <button
                onClick={() => {
                  setPrUrl('');
                  setTicketUrl('');
                  setFindings([]);
                  setPrMeta(null);
                  setSummary(null);
                  setNewUserMsg('');
                  setError('');
                  setRiskScore(0);
                  setPhaseText('Idle');
                }}
                className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 transition px-4 py-3 rounded-xl text-sm font-semibold text-gray-200"
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
              className="mb-6 flex items-center gap-3 bg-blue-950/30 border border-blue-900/40 rounded-xl px-4 py-3 text-sm text-blue-200"
            >
              <UserPlus className="w-5 h-5 text-blue-400 shrink-0" />
              {newUserMsg}
            </motion.div>
          )}
          {error && (
            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-6 flex items-center gap-3 bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-3 text-sm text-red-200"
            >
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* PR Meta */}
        <AnimatePresence>
          {prMeta && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="mb-6 bg-[#111] border border-gray-800 rounded-2xl p-5 shadow-lg"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <GitPullRequest className="w-5 h-5 text-purple-400" />
                    PR #{prMeta.prNumber}: {prMeta.title || 'Untitled PR'}
                  </h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                    <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {prMeta.author}</span>
                    <span className="flex items-center gap-1.5"><FileCode2 className="w-3.5 h-3.5" /> {prMeta.files?.length || 0} files changed</span>
                  </div>
                </div>
                {prMeta.prUrl && (
                  <a href={prMeta.prUrl} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-white transition p-2">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Clean PR Message */}
        {summary && findings.length === 0 && !error && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="mb-8 flex flex-col items-center justify-center p-12 bg-[#111] border border-emerald-900/40 rounded-3xl text-center shadow-2xl"
          >
            <div className="bg-emerald-900/20 p-5 rounded-full mb-5 border border-emerald-500/20">
              <ShieldCheck className="w-10 h-10 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">All Clear!</h3>
            <p className="text-gray-400 max-w-md">No security risks or code quality issues were detected in this pull request. Great work!</p>
          </motion.div>
        )}

        {/* Findings */}
        {Object.keys(grouped).length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-500" />
                Findings
              </h2>
              <div className="flex items-center gap-3 text-xs font-medium">
                {criticalCount > 0 && (
                  <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-1 rounded-lg">
                    {criticalCount} Critical
                  </span>
                )}
                {warningCount > 0 && (
                  <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                    {warningCount} Warnings
                  </span>
                )}
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
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
                  className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                    findingFilter === item.key
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      : 'bg-gray-900/60 text-gray-400 border-gray-800 hover:border-gray-700 hover:text-gray-200'
                  }`}
                >
                  {item.label} ({item.count})
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <AnimatePresence>
                {Object.entries(grouped).map(([filename, rows]) => {
                  const dangerZone = rows.length >= 5;
                  return (
                    <motion.div 
                      key={filename}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`bg-[#111] border rounded-2xl overflow-hidden shadow-lg ${dangerZone ? 'border-red-900/50' : 'border-gray-800'}`}
                    >
                      <div className={`flex items-center justify-between px-5 py-3 ${dangerZone ? 'bg-red-950/20' : 'bg-gray-900/30'}`}>
                        <div className="flex items-center gap-3">
                          <FileCode2 className={`w-4 h-4 ${dangerZone ? 'text-red-400' : 'text-gray-400'}`} />
                          <p className="text-sm font-mono text-gray-200">{filename}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{rows.length} issue{rows.length > 1 ? 's' : ''}</span>
                          {dangerZone && (
                            <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-md font-semibold">
                              DANGER ZONE
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="divide-y divide-gray-800/50">
                        {rows.map((f, idx) => (
                          <div key={`${filename}-${idx}`} className={`px-5 py-4 hover:bg-gray-900/20 transition ${f.severity === 'critical' && Number(f.false_positive || 0) === 0 ? 'bg-red-950/10 border-l-2 border-red-500/40' : ''}`}>
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <SeverityBadge severity={f.severity} />
                              {Number(f.false_positive || 0) === 1 ? (
                                <span className="text-xs text-amber-300 font-semibold bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">LOW PRIORITY</span>
                              ) : null}
                              {Number(f.false_positive || 0) >= 2 ? (
                                <span className="text-xs text-gray-300 font-semibold bg-gray-800/80 border border-gray-700 px-2 py-0.5 rounded">IGNORED</span>
                              ) : null}
                              <span className="text-xs text-gray-500 font-mono bg-gray-800/50 px-2 py-0.5 rounded">{f.rule_name}</span>
                              <span className="text-xs text-gray-500">Line {f.line_number}</span>
                              <span className="ml-auto text-xs font-semibold text-gray-400 tabular-nums">{Math.round(f.confidence)}% confidence</span>
                            </div>
                            <p className="text-sm text-gray-200 leading-relaxed">{f.message}</p>
                            {typeof f.id === 'number' && Number(f.false_positive || 0) < 2 && (
                              <div className="mt-3">
                                <button
                                  onClick={() => advanceFindingSuppression(f.id as number)}
                                  disabled={updatingFindingId === f.id}
                                  className="text-xs border border-gray-700 hover:border-gray-600 disabled:opacity-50 text-gray-300 hover:text-white px-2.5 py-1 rounded-md transition"
                                >
                                  {updatingFindingId === f.id ? 'Saving...' : Number(f.false_positive || 0) === 1 ? 'Mark Again to Ignore' : 'Mark as False Positive'}
                                </button>
                              </div>
                            )}
                            {typeof f.id === 'number' && Number(f.false_positive || 0) >= 2 && (
                              <p className="mt-3 text-xs text-gray-500">Ignored in future scans for this same file + rule.</p>
                            )}
                            {f.fix_hint && (
                              <details className="mt-3 group">
                                <summary className="text-xs text-blue-400 cursor-pointer hover:text-blue-300 transition flex items-center gap-1.5">
                                  <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" />
                                  View fix suggestion
                                </summary>
                                <div className="mt-2 bg-gray-900/50 border border-gray-800/50 rounded-lg px-4 py-3 text-xs text-gray-300 leading-relaxed font-mono">
                                  {f.fix_hint}
                                </div>
                              </details>
                            )}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
            {Object.keys(grouped).length === 0 && (
              <div className="text-sm text-gray-500 border border-gray-800 rounded-xl p-4">
                No findings for this filter.
              </div>
            )}
          </div>
        )}

        {/* Summary */}
        {summary && findings.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 bg-[#111] border border-gray-800 rounded-2xl p-5 shadow-lg"
          >
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              Analysis Complete
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-900/50 rounded-xl p-4 text-center border border-gray-800/50">
                <p className="text-2xl font-bold text-white">{summary.totalFindings}</p>
                <p className="text-xs text-gray-400 mt-1">Total Findings</p>
              </div>
              <div className="bg-gray-900/50 rounded-xl p-4 text-center border border-gray-800/50">
                <p className={`text-2xl font-bold ${summary.riskScore >= 70 ? 'text-red-400' : summary.riskScore >= 40 ? 'text-amber-400' : 'text-emerald-400'}`}>{summary.riskScore}/100</p>
                <p className="text-xs text-gray-400 mt-1">Risk Score</p>
              </div>
              <div className="bg-gray-900/50 rounded-xl p-4 text-center border border-gray-800/50">
                <p className="text-2xl font-bold text-white">{summary.author}</p>
                <p className="text-xs text-gray-400 mt-1">Author</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Navigation Tabs */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-4"
        >
          <Link href={`/projects/${id}/history`} className="group flex flex-col items-center gap-3 bg-[#111] hover:bg-gray-900/50 border border-gray-800 hover:border-blue-500/30 rounded-2xl p-5 transition-all shadow-lg">
            <div className="bg-blue-900/20 p-3 rounded-xl group-hover:bg-blue-600/20 transition">
              <Clock className="w-6 h-6 text-blue-400" />
            </div>
            <span className="text-sm font-semibold text-gray-200">History</span>
            <span className="text-xs text-gray-500">View past analyses</span>
          </Link>
          <Link href={`/projects/${id}/scorecard`} className="group flex flex-col items-center gap-3 bg-[#111] hover:bg-gray-900/50 border border-gray-800 hover:border-emerald-500/30 rounded-2xl p-5 transition-all shadow-lg">
            <div className="bg-emerald-900/20 p-3 rounded-xl group-hover:bg-emerald-600/20 transition">
              <BarChart3 className="w-6 h-6 text-emerald-400" />
            </div>
            <span className="text-sm font-semibold text-gray-200">Scorecard</span>
            <span className="text-xs text-gray-500">Team health scores</span>
          </Link>
          <Link href={`/projects/${id}/heatmap`} className="group flex flex-col items-center gap-3 bg-[#111] hover:bg-gray-900/50 border border-gray-800 hover:border-orange-500/30 rounded-2xl p-5 transition-all shadow-lg">
            <div className="bg-orange-900/20 p-3 rounded-xl group-hover:bg-orange-600/20 transition">
              <Flame className="w-6 h-6 text-orange-400" />
            </div>
            <span className="text-sm font-semibold text-gray-200">Heatmap</span>
            <span className="text-xs text-gray-500">Bug density map</span>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
