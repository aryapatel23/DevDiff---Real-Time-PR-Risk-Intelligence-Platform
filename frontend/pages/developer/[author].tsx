import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ScoreBar from '../../components/ScoreBar';

type DeveloperStats = {
  author: string;
  prs_analyzed: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  avg_confidence: number;
  score: number;
};

type RuleRow = {
  rule_name: string;
  count?: number;
  total?: number;
  critical?: number;
};

type FindingRow = {
  id: number;
  pr_id: number;
  filename: string;
  line_number: number;
  rule_name: string;
  severity: 'critical' | 'warning' | 'info';
  confidence: number;
  message: string;
  created_at: string;
};

type PRRow = {
  id: number;
  pr_url: string;
  repo: string;
  pr_number: number;
  risk_score: number;
  analyzed_at: string;
  files_count: number;
  status: string;
};

type DeveloperResponse = {
  author: string;
  stats: DeveloperStats | null;
  escalatedRules: string[];
  patterns: RuleRow[];
  topRules: RuleRow[];
  recentFindings: FindingRow[];
  recentPRs: PRRow[];
  profile?: {
    personalized_weights?: {
      severity?: { critical?: number; warning?: number; info?: number };
      rules?: Record<string, number>;
    };
    thresholds?: { base?: number; escalated?: number };
    profile_stats?: Record<string, number>;
  };
  isNewProfile?: boolean;
};

export default function DeveloperPage() {
  const router = useRouter();
  const author = typeof router.query.author === 'string' ? router.query.author : '';

  const [data, setData] = useState<DeveloperResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  useEffect(() => {
    if (!author) return;

    setLoading(true);
    setError('');

    fetch(`${API}/api/developer/${encodeURIComponent(author)}`)
      .then(async res => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Failed to load developer analysis');
        return body as DeveloperResponse;
      })
      .then(body => {
        setData(body);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to load developer analysis');
        setLoading(false);
      });
  }, [API, author]);

  const score = data?.stats?.score ?? 0;
  const escalated = new Set(data?.escalatedRules || []);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/scorecard" className="text-gray-500 hover:text-gray-300 text-sm">← Back</Link>
          <h1 className="text-xl font-bold text-white">Developer Analysis</h1>
          {author && <span className="text-sm text-blue-300">{author}</span>}
        </div>

        {loading && <p className="text-gray-500 text-sm">Loading developer profile…</p>}

        {error && (
          <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-3 mb-4 text-red-300 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && data && (
          <>
            {data.isNewProfile && (
              <div className="bg-blue-950 border border-blue-800 rounded-xl p-4 mb-5 text-sm text-blue-200">
                New profile initialized for this developer. Personalized weights and thresholds will adapt automatically after each analysis.
              </div>
            )}

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-5">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
                <Stat label="PRs" value={String(data.stats?.prs_analyzed ?? 0)} />
                <Stat label="Critical" value={String(data.stats?.critical_count ?? 0)} tone="text-red-400" />
                <Stat label="Warnings" value={String(data.stats?.warning_count ?? 0)} tone="text-amber-400" />
                <Stat label="Avg confidence" value={`${data.stats?.avg_confidence ?? 0}`} />
                <Stat label="Escalated rules" value={String(data.escalatedRules.length)} tone="text-purple-300" />
              </div>
              <ScoreBar score={score} />
            </div>

            <section className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-5">
              <h2 className="text-sm font-semibold text-white mb-3">Personalized Scoring Profile</h2>
              <div className="grid md:grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-800 rounded px-3 py-2">
                  <p className="text-gray-400 text-xs mb-1">Severity weights</p>
                  <p className="text-gray-200">critical {data.profile?.personalized_weights?.severity?.critical ?? 1} · warning {data.profile?.personalized_weights?.severity?.warning ?? 1} · info {data.profile?.personalized_weights?.severity?.info ?? 1}</p>
                </div>
                <div className="bg-gray-800 rounded px-3 py-2">
                  <p className="text-gray-400 text-xs mb-1">Thresholds</p>
                  <p className="text-gray-200">base {data.profile?.thresholds?.base ?? 65} · escalated {data.profile?.thresholds?.escalated ?? 50}</p>
                </div>
              </div>
            </section>

            <div className="grid md:grid-cols-2 gap-5">
              <section className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-white mb-3">Recurring Patterns</h2>
                <div className="space-y-2">
                  {data.patterns.length === 0 && <p className="text-xs text-gray-500">No pattern data.</p>}
                  {data.patterns.map(p => (
                    <div key={p.rule_name} className="flex items-center justify-between text-sm bg-gray-800 rounded px-3 py-2">
                      <span className="text-gray-200">{p.rule_name}</span>
                      <span className="text-gray-400">{p.count ?? 0}x</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-white mb-3">Top Rules</h2>
                <div className="space-y-2">
                  {data.topRules.length === 0 && <p className="text-xs text-gray-500">No top rule data.</p>}
                  {data.topRules.map(r => (
                    <div key={r.rule_name} className="flex items-center justify-between text-sm bg-gray-800 rounded px-3 py-2">
                      <span className="text-gray-200">{r.rule_name}</span>
                      <span className="text-gray-400">
                        {r.total ?? 0} total{escalated.has(r.rule_name) ? ' · escalated' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section className="bg-gray-900 border border-gray-800 rounded-xl p-4 mt-5">
              <h2 className="text-sm font-semibold text-white mb-3">Recent Findings</h2>
              <div className="space-y-2 max-h-[320px] overflow-auto pr-1">
                {data.recentFindings.length === 0 && <p className="text-xs text-gray-500">No recent findings.</p>}
                {data.recentFindings.map(f => (
                  <div key={f.id} className="bg-gray-800 rounded px-3 py-2">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className={`text-xs uppercase font-semibold ${f.severity === 'critical' ? 'text-red-400' : f.severity === 'warning' ? 'text-amber-400' : 'text-blue-400'}`}>
                        {f.severity}
                      </span>
                      <span className="text-xs text-gray-500">{f.confidence}%</span>
                    </div>
                    <p className="text-sm text-gray-200">{f.message}</p>
                    <p className="text-xs text-gray-500 mt-1 font-mono">{f.filename}:{f.line_number} · {f.rule_name}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-gray-900 border border-gray-800 rounded-xl p-4 mt-5">
              <h2 className="text-sm font-semibold text-white mb-3">Recent PRs</h2>
              <div className="space-y-2">
                {data.recentPRs.length === 0 && <p className="text-xs text-gray-500">No PR history.</p>}
                {data.recentPRs.map(pr => (
                  <a key={pr.id} href={pr.pr_url} target="_blank" rel="noreferrer" className="block bg-gray-800 hover:bg-gray-700 rounded px-3 py-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-blue-300">{pr.repo} #{pr.pr_number}</span>
                      <span className="text-gray-400">risk {pr.risk_score}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{pr.analyzed_at} · {pr.files_count} files</p>
                  </a>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone = 'text-gray-200' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-gray-800 rounded px-3 py-2">
      <div className={`text-lg font-semibold ${tone}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
