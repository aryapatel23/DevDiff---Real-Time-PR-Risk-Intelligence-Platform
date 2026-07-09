import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../lib/auth';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderGit2,
  ShieldAlert,
  Activity,
  Lock,
  Plus,
  Github,
  AlertCircle,
  FolderOpen,
  ArrowRight,
  X,
} from 'lucide-react';

type Project = {
  id: string;
  name: string;
  github_repo: string;
  description: string | null;
  is_private: boolean;
  import_status: string;
  import_count: number;
  analysis_status?: string;
  analysis_count?: number;
  analysis_total?: number;
  pr_count: number;
  scanned_pr_count?: number;
  historical_pr_count?: number;
  finding_count: number;
};

type Repo = {
  full_name: string;
  private: boolean;
  language: string | null;
};

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function ScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 70 ? 'var(--critical)' : score >= 40 ? 'var(--high)' : 'var(--low)';

  return (
    <svg width={size} height={size} className="score-ring">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--surface-3)"
        strokeWidth={4}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference - progress}
        className="score-ring-fill"
      />
    </svg>
  );
}

export default function DashboardPage() {
  const { session, loading, apiHeaders, signOut } = useAuth();
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedRepo, setSelectedRepo] = useState('');
  const [repoInputMode, setRepoInputMode] = useState<'list' | 'manual'>('list');
  const [manualRepo, setManualRepo] = useState('');

  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    if (!loading && !session) router.replace('/login');
  }, [loading, session, router]);

  async function loadProjects() {
    if (!session) return;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(`${API}/api/projects`, {
        headers: apiHeaders(),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load projects');
      setProjects(data);
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setError('Request timed out. Check if the backend is running on port 4000.');
      } else if (e.message?.includes('Failed to fetch') || e.message?.includes('NetworkError')) {
        setError('Cannot connect to backend. Make sure the server is running (npm run dev).');
      } else {
        setError(e.message || 'Failed to load projects');
      }
    } finally {
      setInitialLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, [session]);

  async function openAddModal() {
    setShowAdd(true);
    setReposLoading(true);
    setError('');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(`${API}/api/auth/repos`, {
        headers: apiHeaders(),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load repos');
      setRepos(data);
      if (data[0]) setSelectedRepo(data[0].full_name);
      setRepoInputMode(data[0] ? 'list' : 'manual');
      setManualRepo('');
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setError('GitHub repos timed out. You can enter the repo manually.');
      } else {
        setError(e.message || 'Failed to load repos');
      }
      setRepoInputMode('manual');
    } finally {
      setReposLoading(false);
    }
  }

  async function createProject() {
    setSaving(true);
    setError('');
    try {
      const repoValue = repoInputMode === 'manual' ? manualRepo.trim() : selectedRepo;
      const chosen = repos.find(r => r.full_name === repoValue);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`${API}/api/projects`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({
          name,
          github_repo: repoValue,
          description,
          is_private: chosen?.private || false,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create project');

      setShowAdd(false);
      setName('');
      setDescription('');
      setSelectedRepo('');
      setManualRepo('');
      // Redirect to the new project page
      router.push(`/projects/${data.id}`);
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setError('Project creation timed out. The server may be overloaded.');
      } else if (e.message?.includes('Failed to fetch') || e.message?.includes('NetworkError')) {
        setError('Cannot connect to backend. Make sure the server is running.');
      } else {
        setError(e.message || 'Failed to create project');
      }
    } finally {
      setSaving(false);
    }
  }

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => (b.finding_count || 0) - (a.finding_count || 0));
  }, [projects]);

  const totalFindings = useMemo(() => projects.reduce((sum, p) => sum + (p.finding_count || 0), 0), [projects]);
  const totalPrs = useMemo(() => projects.reduce((sum, p) => sum + (p.pr_count || 0), 0), [projects]);

  if (loading || !session) return <div className="min-h-screen bg-void" />;

  return (
    <div className="p-6 md:p-8 max-w-[1200px] mx-auto">
      {/* Header */}
      <header className="mb-10">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight gradient-text">
              Dashboard
            </h1>
            <p className="text-text-dim text-sm mt-1">Manage your projects and security findings</p>
          </div>
          <button
            onClick={openAddModal}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>

        {/* Stats bar */}
        {sortedProjects.length > 0 && (
          <div className="flex gap-6 mt-6 p-4 rounded-xl bg-surface-1 border border-border-faint">
            <div className="flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-accent" />
              <span className="text-sm text-text-dim">Projects</span>
              <span className="text-sm font-bold text-text-bright">{projects.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-info" />
              <span className="text-sm text-text-dim">PRs Indexed</span>
              <span className="text-sm font-bold text-text-bright">{totalPrs}</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-high" />
              <span className="text-sm text-text-dim">Findings</span>
              <span className="text-sm font-bold text-text-bright">{totalFindings}</span>
            </div>
          </div>
        )}
      </header>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-6 flex items-center gap-3 bg-critical/10 border border-critical/20 rounded-xl px-4 py-3 text-sm text-critical"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError('')} className="text-critical/60 hover:text-critical">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      {initialLoading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Activity className="w-8 h-8 text-accent animate-spin" />
          <p className="mt-4 text-text-dim text-sm">Loading your projects...</p>
        </div>
      ) : sortedProjects.length === 0 ? (
        /* Empty State */
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center p-16 glow-card text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-6">
            <FolderOpen className="w-8 h-8 text-accent" />
          </div>
          <h2 className="text-2xl font-bold text-text-bright mb-2">No projects yet</h2>
          <p className="text-text-dim max-w-md mb-8 text-sm leading-relaxed">
            Connect a GitHub repository to start analyzing pull requests for security risks and code quality issues.
          </p>
          <button onClick={openAddModal} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Connect your first repository
          </button>
        </motion.div>
      ) : (
        /* Project Grid */
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence>
            {sortedProjects.map((p, idx) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04, duration: 0.3 }}
              >
                <Link
                  href={`/projects/${p.id}`}
                  className="group glow-card flex flex-col h-full p-5 hover:border-accent/30 transition-all duration-200"
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/15 transition-colors">
                        <FolderGit2 className="w-5 h-5 text-accent" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-text-bright truncate text-sm">{p.name}</h3>
                        <p className="text-xs text-text-dim font-mono flex items-center gap-1 mt-0.5 truncate">
                          <Github className="w-3 h-3 shrink-0" />
                          {p.github_repo}
                        </p>
                      </div>
                    </div>
                    {p.is_private && (
                      <Lock className="w-3.5 h-3.5 text-text-dim shrink-0 mt-1" />
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-text-dim mb-4 line-clamp-2 flex-grow leading-relaxed">
                    {p.description || 'No description provided.'}
                  </p>

                  {/* Status */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs">
                      {p.import_status === 'pending' && (
                        <span className="badge badge-info">Pending</span>
                      )}
                      {p.import_status === 'running' && (
                        <span className="badge badge-accent">
                          <Activity className="w-3 h-3 animate-pulse" />
                          Importing ({p.import_count}/30)
                        </span>
                      )}
                      {p.import_status === 'done' && p.analysis_status === 'running' && (
                        <span className="badge badge-accent">
                          <Activity className="w-3 h-3 animate-pulse" />
                          Analyzing ({p.analysis_count}/{p.analysis_total})
                        </span>
                      )}
                      {p.import_status === 'done' && p.analysis_status === 'done' && (
                        <span className="badge badge-low">
                          <ShieldAlert className="w-3 h-3" />
                          {p.import_count} PRs · {p.analysis_count} analyzed
                        </span>
                      )}
                      {p.import_status === 'done' && !p.analysis_status && (
                        <span className="badge badge-low">{p.import_count} PRs indexed</span>
                      )}
                      {p.import_status === 'done' && p.analysis_status === 'idle' && (
                        <span className="badge badge-low">{p.import_count} PRs indexed</span>
                      )}
                      {p.import_status === 'error' && (
                        <span className="badge badge-critical">Import failed</span>
                      )}
                      {p.analysis_status === 'error' && (
                        <span className="badge badge-high">Analysis failed</span>
                      )}
                    </div>

                    {/* Bottom stats */}
                    <div className="flex items-center justify-between border-t border-border-faint pt-3">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5 text-xs text-text-dim">
                          <FolderGit2 className="w-3.5 h-3.5" />
                          {p.pr_count} PRs
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-high">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          {p.finding_count} risks
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-text-dim group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add Project Modal */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-void/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 12 }}
              className="w-full max-w-lg glow-card glow-border p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-text-bright flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Plus className="w-4 h-4 text-accent" />
                  </div>
                  Add New Project
                </h2>
                <button onClick={() => setShowAdd(false)} className="p-1.5 rounded-lg text-text-dim hover:text-text-bright hover:bg-surface-2 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-dim mb-1.5 uppercase tracking-wider">Project Name</label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Core API Backend"
                    className="input-field"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-text-dim uppercase tracking-wider">Target Repository</label>
                    <div className="flex bg-surface-2 rounded-lg p-0.5 border border-border-faint">
                      <button
                        onClick={() => setRepoInputMode('list')}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition ${repoInputMode === 'list' ? 'bg-surface-3 text-text-bright shadow-sm' : 'text-text-dim hover:text-text-normal'}`}
                      >
                        Select
                      </button>
                      <button
                        onClick={() => setRepoInputMode('manual')}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition ${repoInputMode === 'manual' ? 'bg-surface-3 text-text-bright shadow-sm' : 'text-text-dim hover:text-text-normal'}`}
                      >
                        Manual
                      </button>
                    </div>
                  </div>

                  {reposLoading ? (
                    <div className="input-field flex items-center gap-3 text-text-dim">
                      <Activity className="w-4 h-4 animate-spin text-accent" /> Connecting to GitHub...
                    </div>
                  ) : repoInputMode === 'manual' ? (
                    <input
                      value={manualRepo}
                      onChange={e => setManualRepo(e.target.value)}
                      placeholder="owner/repo"
                      className="input-field font-mono"
                    />
                  ) : (
                    <select
                      value={selectedRepo}
                      onChange={e => setSelectedRepo(e.target.value)}
                      className="input-field"
                    >
                      {repos.map(r => (
                        <option key={r.full_name} value={r.full_name}>
                          {r.private ? '🔒 ' : ''}{r.full_name}{r.language ? ` (${r.language})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-dim mb-1.5 uppercase tracking-wider">Description (Optional)</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Brief details about this project..."
                    className="input-field resize-none"
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border-faint">
                <button onClick={() => setShowAdd(false)} className="btn-ghost text-sm">Cancel</button>
                <button
                  onClick={createProject}
                  disabled={saving || !name || (repoInputMode === 'manual' ? !manualRepo.trim() : !selectedRepo)}
                  className="btn-primary text-sm flex items-center gap-2 disabled:opacity-40"
                >
                  {saving && <Activity className="w-4 h-4 animate-spin" />}
                  {saving ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
