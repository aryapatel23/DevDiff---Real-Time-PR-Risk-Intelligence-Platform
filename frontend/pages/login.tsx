import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../lib/auth';
import { motion } from 'framer-motion';
import { Github, ShieldCheck, Activity } from 'lucide-react';

export default function LoginPage() {
  const { session, loading, signInWithGitHub } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && session) {
      router.replace('/dashboard');
    }
  }, [loading, session, router]);

  return (
    <div className="relative min-h-screen bg-[#0a0a0a] text-gray-100 flex items-center justify-center p-6 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-900/20 blur-[120px] rounded-full pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md bg-[#111] border border-gray-800 rounded-3xl p-8 shadow-2xl backdrop-blur-sm"
      >
        <div className="flex justify-center mb-6">
          <div className="bg-gradient-to-tr from-blue-600 to-purple-600 p-3 rounded-2xl shadow-lg">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
        </div>
        
        <h1 className="text-3xl font-extrabold text-white text-center mb-2 tracking-tight">DevDiff</h1>
        <p className="text-sm text-gray-400 mb-8 text-center">PR intelligence that remembers your patterns</p>

        <div className="space-y-4 mb-8">
          <div className="flex items-center gap-3 text-sm text-gray-300 bg-gray-900/50 p-3 rounded-xl border border-gray-800/50">
            <Activity className="w-5 h-5 text-blue-400" />
            <span>Real-time Risk Analysis</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-300 bg-gray-900/50 p-3 rounded-xl border border-gray-800/50">
            <ShieldCheck className="w-5 h-5 text-green-400" />
            <span>Custom ML Scoring Engine</span>
          </div>
        </div>

        <button
          onClick={signInWithGitHub}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-white text-black rounded-xl py-3 font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          <Github className="w-5 h-5" />
          Continue with GitHub
        </button>

        <p className="text-xs text-gray-600 mt-5 text-center px-4">
          By continuing, you grant DevDiff access to scan your repositories for security analysis.
        </p>
      </motion.div>
    </div>
  );
}
