import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../lib/auth';
import { motion } from 'framer-motion';
import { Github, ShieldCheck, Zap, Eye } from 'lucide-react';

export default function LoginPage() {
  const { session, loading, signInWithGitHub } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && session) {
      router.replace('/dashboard');
    }
  }, [loading, session, router]);

  return (
    <div className="relative min-h-screen bg-void text-text-normal flex items-center justify-center p-6 overflow-hidden bg-grid">
      {/* Ambient glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-accent/5 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-critical/5 blur-[150px] rounded-full pointer-events-none" />

      {/* Grid lines decoration */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]">
        <div className="absolute top-0 left-1/3 w-px h-full bg-white" />
        <div className="absolute top-0 left-2/3 w-px h-full bg-white" />
        <div className="absolute top-1/3 left-0 w-full h-px bg-white" />
        <div className="absolute top-2/3 left-0 w-full h-px bg-white" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo & Brand */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 mb-6"
          >
            <ShieldCheck className="w-8 h-8 text-accent" />
          </motion.div>
          <h1 className="text-4xl font-extrabold text-text-bright tracking-tight mb-2">
            Dev<span className="text-accent">Diff</span>
          </h1>
          <p className="text-text-dim text-sm">PR Intelligence that remembers your patterns</p>
        </div>

        {/* Login Card */}
        <div className="glow-card p-8">
          {/* Feature highlights */}
          <div className="space-y-3 mb-8">
            <div className="flex items-center gap-3 text-sm text-text-normal p-3 rounded-xl bg-surface-2/50 border border-border-faint">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-accent" />
              </div>
              <span>Real-time Risk Analysis</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-text-normal p-3 rounded-xl bg-surface-2/50 border border-border-faint">
              <div className="w-8 h-8 rounded-lg bg-low/10 flex items-center justify-center shrink-0">
                <Eye className="w-4 h-4 text-safe" />
              </div>
              <span>Custom ML Scoring Engine</span>
            </div>
          </div>

          {/* GitHub Sign In */}
          <button
            onClick={signInWithGitHub}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-text-bright text-void rounded-xl py-3.5 font-bold hover:bg-white transition-all disabled:opacity-50 text-sm"
          >
            <Github className="w-5 h-5" />
            Continue with GitHub
          </button>

          <p className="text-xs text-text-dim mt-5 text-center px-4 leading-relaxed">
            By continuing, you grant DevDiff access to scan your repositories for security analysis.
          </p>
        </div>

        {/* Bottom tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center text-xs text-text-dim/60 mt-8"
        >
          Built for teams who ship fast and stay secure.
        </motion.p>
      </motion.div>
    </div>
  );
}
