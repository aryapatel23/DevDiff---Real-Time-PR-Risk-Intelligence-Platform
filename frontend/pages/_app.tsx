import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import localFont from 'next/font/local';
import { AuthProvider } from '../lib/auth';
import { AppShell } from '../components/AppShell';

const geistSans = localFont({
  src: '../node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2',
  variable: '--font-geist-sans',
  display: 'swap',
  weight: '100 900',
});

const geistMono = localFont({
  src: '../node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2',
  variable: '--font-geist-mono',
  display: 'swap',
  weight: '100 900',
});

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isAuthPage = router.pathname === '/login';

  return (
    <div className={`${geistSans.variable} ${geistMono.variable}`}>
      <AuthProvider>
        {isAuthPage ? (
          <Component {...pageProps} />
        ) : (
          <AppShell>
            <Component {...pageProps} />
          </AppShell>
        )}
      </AuthProvider>
    </div>
  );
}
