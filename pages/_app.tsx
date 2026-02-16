import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('callx-auth');
      if (saved === '1') setAuthed(true);
    }
  }, []);

  const checkPin = () => {
    if (pin === '0524') {
      sessionStorage.setItem('callx-auth', '1');
      setAuthed(true);
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  if (!mounted) return null;

  if (!authed) {
    return (
      <div className="min-h-screen bg-av-navy flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 shadow-2xl w-full max-w-sm text-center">
          <div className="w-14 h-14 bg-av-orange rounded-xl flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4">C</div>
          <h1 className="text-xl font-bold text-av-navy mb-1">CallX OS</h1>
          <p className="text-gray-400 text-sm mb-6">by Angloville</p>
          <input
            type="password"
            placeholder="PIN"
            value={pin}
            onChange={e => { setPin(e.target.value); setPinError(false); }}
            onKeyDown={e => e.key === 'Enter' && checkPin()}
            className={`w-full text-center text-2xl tracking-[0.5em] border-2 rounded-xl px-4 py-3 mb-3 focus:outline-none ${
              pinError ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-av-blue'
            }`}
            maxLength={4}
            autoFocus
          />
          {pinError && <p className="text-red-500 text-sm mb-3">Błędny PIN</p>}
          <button
            onClick={checkPin}
            className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-av-blue to-av-blue-dark hover:shadow-lg"
          >
            Wejdź
          </button>
        </div>
      </div>
    );
  }

  // Lead detail pages without sidebar
  const noLayout = router.pathname.startsWith('/leads/');
  if (noLayout) {
    return <Component {...pageProps} />;
  }

  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
}
