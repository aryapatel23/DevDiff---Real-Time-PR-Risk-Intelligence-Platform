import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getSupabaseClient } from './supabase';

interface AuthContextType {
  session: any;
  user: any;
  githubToken: string | null;
  loading: boolean;
  signInWithGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
  apiHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<any>(null);
  const [githubToken, setGithubToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe = () => {};

    try {
      const supabase = getSupabaseClient();
      supabase.auth.getSession().then(({ data }) => {
        setSession(data.session);
        if (data.session?.provider_token) {
          setGithubToken(data.session.provider_token);
        }
        setLoading(false);
      });

      const { data: listener } = supabase.auth.onAuthStateChange(async (event, s) => {
        setSession(s);
        if (s?.provider_token) {
          setGithubToken(s.provider_token);
        } else if (event === 'TOKEN_REFRESHED' && s) {
          const { data } = await supabase.auth.getSession();
          if (data.session?.provider_token) {
            setGithubToken(data.session.provider_token);
          }
        }
      });

      unsubscribe = () => listener.subscription.unsubscribe();
    } catch {
      setLoading(false);
    }

    return () => unsubscribe();
  }, []);

  const signInWithGitHub = async () => {
    const supabase = getSupabaseClient();
    const redirectTo = process.env.NEXT_PUBLIC_AUTH_REDIRECT_TO || `${window.location.origin}/dashboard`;
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        scopes: 'repo user:email',
        redirectTo,
      },
    });
  };

  const signOut = async () => {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    setGithubToken(null);
  };

  const apiHeaders = () => ({
    Authorization: `Bearer ${session?.access_token || ''}`,
    'X-GitHub-Token': githubToken || '',
    'Content-Type': 'application/json',
  });

  return (
    <AuthContext.Provider value={{ session, user: session?.user, githubToken, loading, signInWithGitHub, signOut, apiHeaders }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
