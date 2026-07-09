import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../lib/auth';

export default function IndexPage() {
  const { loading, session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (session) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [loading, session, router]);

  return <div className="min-h-screen bg-void" />;
}
