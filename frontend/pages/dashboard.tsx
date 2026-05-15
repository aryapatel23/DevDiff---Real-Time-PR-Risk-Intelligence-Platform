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
  LogOut, 
  Github, 
  AlertCircle,
  FolderOpen
} from 'lucide-react';

type Project = {
  id: string;
  name: string;
  github_repo: string;
  description: string | null;
  is_private: boolean;
  import_status: string;
  import_count: number;
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
      const res = await fetch(`${API}/api/projects`, { headers: apiHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load projects');
      setProjects(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load projects');
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
      const res = await fetch(`${API}/api/auth/repos`, { headers: apiHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load repos');
      setRepos(data);
      if (data[0]) setSelectedRepo(data[0].full_name);
      setRepoInputMode(data[0] ? 'list' : 'manual');
      setManualRepo('');
    } catch (e: any) {
      // It's possible the user logged in before GitHub scope addition, error might be thrown.
      setError(e.message || 'Failed to load repos');
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
      const res = await fetch(`${API}/api/projects`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({
          name,
          github_repo: repoValue,
          description,
          is_private: chosen?.private || false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create project');

      setShowAdd(false);
      setName('');
      setDescription('');
      setSelectedRepo('');
      setManualRepo('');
      await loadProjects();
    } catch (e: any) {
      setError(e.message || 'Failed to create project');
    } finally {
      setSaving(false);
    }
  }

  const sortedProjects = useMemo(() => projects, [projects]);

  if (loading || !session) return <div className="min-h-screen bg-[#0a0a0a]" />;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-10 pb-6 border-b border-gray-800/50">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-sm text-gray-500 mt-1">Manage your active projects and security findings</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={openAddModal} 
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 transition shadow-lg shadow-blue-900/20 px-4 py-2 rounded-xl text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              New Project
            </button>
            <button 
              onClick={signOut} 
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 transition px-4 py-2 rounded-xl text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </header>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex items-center gap-3 bg-red-950/50 border border-red-900/50 rounded-xl px-4 py-3 text-sm text-red-200"
          >
            <AlertCircle className="w-5 h-5 text-red-400" />
            {error}
          </motion.div>
        )}

        {initialLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Activity className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="mt-4 text-gray-500">Loading your projects...</p>
          </div>
        ) : sortedProjects.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center p-16 bg-[#111] border border-gray-800/60 rounded-3xl text-center shadow-2xl"
          >
            <div className="bg-gray-800/50 p-6 rounded-full mb-6 relative">
              <FolderOpen className="w-12 h-12 text-blue-400" />
              <div className="absolute top-0 right-0 w-4 h-4 bg-blue-500 rounded-full animate-ping" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">No projects found</h2>
            <p className="text-gray-400 max-w-md mb-8">
              You haven't added any GitHub repositories yet. Connect a project to start analyzing pull requests for security risks and code quality issues.
            </p>
            <button 
              onClick={openAddModal} 
              className="bg-white text-black hover:bg-gray-200 transition px-6 py-3 rounded-xl font-semibold shadow-lg flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Connect your first repository
            </button>
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            <AnimatePresence>
              {sortedProjects.map((p, idx) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Link 
                    href={`/projects/${p.id}`} 
                    className="group flex flex-col h-full bg-[#111] border border-gray-800 rounded-2xl p-5 hover:border-blue-500/50 hover:bg-gray-900/50 transition-all duration-300 shadow-lg"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-900/30 p-2 rounded-lg group-hover:bg-blue-600/20 transition-colors">
                          <FolderGit2 className="w-5 h-5 text-blue-400" />
                        </div>
                        <h3 className="font-bold text-lg text-gray-100 truncate">{p.name}</h3>
                      </div>
                      {p.is_private && (
                        <span title="Private Repository" className="bg-gray-800 text-gray-400 p-1.5 rounded-md">
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                    
                    <p className="text-xs font-mono text-gray-500 mb-4 truncate flex items-center gap-1.5">
                      <Github className="w-3 h-3" />
                      {p.github_repo}
                    </p>
                    
                    <p className="text-sm text-gray-400 mb-6 line-clamp-2 flex-grow">
                      {p.description || 'No description provided for this project.'}
                    </p>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-medium">
                        {p.import_status === 'pending' && <span className="flex items-center gap-1.5 text-gray-500"><Activity className="w-3 h-3"/> Pending sync</span>}
                        {p.import_status === 'running' && <span className="flex items-center gap-1.5 text-blue-400"><Activity className="w-3 h-3 animate-pulse"/> Syncing ({p.import_count}/30)...</span>}
                        {p.import_status === 'done' && <span className="flex items-center gap-1.5 text-emerald-400"><Activity className="w-3 h-3"/> {p.import_count} PRs indexed</span>}
                        {p.import_status === 'error' && <span className="flex items-center gap-1.5 text-red-400"><AlertCircle className="w-3 h-3"/> Sync failed</span>}
                      </div>

                      <div className="flex items-center gap-4 border-t border-gray-800/60 pt-3 mt-auto">
                        <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                          <FolderGit2 className="w-3.5 h-3.5" />
                          <span>{p.pr_count} PRs</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-amber-400/90 text-xs">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>{p.finding_count} risks</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-[#111] border border-gray-800 rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Plus className="w-5 h-5 text-blue-500" />
                  Add New Project
                </h2>
                <button onClick={() => setShowAdd(false)} className="text-gray-500 hover:text-white p-1">
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Project Name</label>
                  <input 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="e.g. Core API Backend"
                    className="w-full bg-gray-900 border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition rounded-xl px-4 py-2.5 text-sm" 
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-gray-400">Target Repository</label>
                    <div className="flex bg-gray-900 rounded-lg p-0.5 border border-gray-800">
                      <button
                        onClick={() => setRepoInputMode('list')}
                        type="button"
                        className={`px-3 py-1 rounded-md text-xs font-medium transition ${repoInputMode === 'list' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                      >
                        Select
                      </button>
                      <button
                        onClick={() => setRepoInputMode('manual')}
                        type="button"
                        className={`px-3 py-1 rounded-md text-xs font-medium transition ${repoInputMode === 'manual' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                      >
                        Manual
                      </button>
                    </div>
                  </div>
                  
                  {reposLoading ? (
                    <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-gray-400">
                      <Activity className="w-4 h-4 animate-spin text-blue-500" /> Connecting to GitHub...
                    </div>
                  ) : repoInputMode === 'manual' ? (
                    <input
                      value={manualRepo}
                      onChange={e => setManualRepo(e.target.value)}
                      placeholder="owner/repo"
                      className="w-full bg-gray-900 border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition rounded-xl px-4 py-2.5 text-sm font-mono"
                    />
                  ) : (
                    <select 
                      value={selectedRepo} 
                      onChange={e => setSelectedRepo(e.target.value)} 
                      className="w-full bg-gray-900 border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition rounded-xl px-4 py-2.5 text-sm"
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
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Description (Optional)</label>
                  <textarea 
                    value={description} 
                    onChange={e => setDescription(e.target.value)} 
                    placeholder="Brief details about this project..."
                    className="w-full bg-gray-900 border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition rounded-xl px-4 py-2.5 text-sm resize-none" 
                    rows={3} 
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-800/50">
                <button onClick={() => setShowAdd(false)} className="px-5 py-2.5 text-gray-400 hover:text-white transition font-medium text-sm">Cancel</button>
                <button 
                  onClick={createProject} 
                  disabled={saving || !name || (repoInputMode === 'manual' ? !manualRepo.trim() : !selectedRepo)} 
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 transition shadow-lg shadow-blue-900/20 rounded-xl font-medium text-sm disabled:opacity-50 flex items-center gap-2"
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
