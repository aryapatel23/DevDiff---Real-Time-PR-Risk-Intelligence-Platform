import { useEffect, useState } from 'react';
import ScoreBar from '../components/ScoreBar';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Users, Activity, ShieldCheck, AlertTriangle } from 'lucide-react';

type DevScore = {
  author: string; score: number;
  critical_count: number; warning_count: number; info_count: number;
};

export default function Scorecard() {
  const [data, setData]     = useState<DevScore[]>([]);
  const [loading, setLoading] = useState(true);
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  useEffect(() => {
    fetch(`${API}/api/scorecard`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const badge = (score: number) =>
    score >= 80 ? { label: 'Clean',  cls: 'bg-green-500/10 text-green-400 border-green-500/20', icon: ShieldCheck } :
    score >= 50 ? { label: 'Watch',  cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: Activity } :
                  { label: 'Risky',  cls: 'bg-red-500/10 text-red-400 border-red-500/20',     icon: AlertTriangle };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="flex flex-col gap-2 mb-10 pb-6 border-b border-gray-800/50">
          <Link href="/dashboard" className="flex items-center gap-2 text-gray-500 hover:text-white transition w-fit text-sm font-medium mb-2">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent flex items-center gap-3">
                <Users className="w-8 h-8 text-blue-500" />
                Team Health Scorecard
              </h1>
              <p className="text-sm text-gray-500 mt-1">Monitor developer risk profiles and code quality patterns</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 shadow-inner">
              Last 30 days
            </div>
          </div>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Activity className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="mt-4 text-gray-500">Loading team scores...</p>
          </div>
        ) : data.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center p-16 bg-[#111] border border-gray-800/60 rounded-3xl text-center shadow-2xl"
          >
            <div className="bg-blue-900/20 p-6 rounded-full mb-6 relative border border-blue-500/20">
              <Users className="w-12 h-12 text-blue-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">No team data yet</h2>
            <p className="text-gray-400 max-w-md mb-8">
              We need a baseline to generate developer health scores. Run at least 2 PR analyses to reveal team patterns here.
            </p>
            <Link 
              href="/dashboard" 
              className="bg-white text-black hover:bg-gray-200 transition px-6 py-3 rounded-xl font-semibold shadow-lg"
            >
              Go to Dashboard
            </Link>
          </motion.div>
        ) : (
          <div className="grid gap-4">
            <AnimatePresence>
              {data.map((dev, idx) => {
                const b = badge(dev.score);
                const Icon = b.icon;
                return (
                  <motion.div
                    key={dev.author}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-[#111] border border-gray-800 rounded-2xl p-6 shadow-lg hover:border-gray-700 transition"
                  >
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-gray-800 to-gray-700 border border-gray-600 flex items-center justify-center text-white text-lg font-bold shadow-inner">
                          {dev.author.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <Link href={`/profile/${encodeURIComponent(dev.author)}`} className="font-bold text-white text-lg hover:text-blue-400 transition">
                            {dev.author}
                          </Link>
                          <div className="flex items-center gap-3 mt-1 text-sm">
                            <span className="text-red-400 font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              {dev.critical_count} critical
                            </span>
                            <span className="text-gray-600">•</span>
                            <span className="text-amber-400 font-medium flex items-center gap-1">
                              <Activity className="w-3.5 h-3.5" />
                              {dev.warning_count} warnings
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className={`flex items-center gap-2 border px-3 py-1.5 rounded-lg ${b.cls}`}>
                        <Icon className="w-4 h-4" />
                        <span className="font-semibold text-sm">{b.label}</span>
                      </div>
                    </div>
                    
                    <div className="mt-2 bg-gray-900/50 p-4 rounded-xl border border-gray-800/50">
                      <ScoreBar score={dev.score} />
                    </div>
                    
                    {dev.score < 50 && (
                      <div className="mt-4 flex items-center gap-2 text-xs font-medium text-red-400 bg-red-950/20 px-3 py-2 rounded-lg border border-red-900/30">
                        <AlertTriangle className="w-4 h-4" />
                        Rules have been auto-escalated for this developer's future PRs.
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
