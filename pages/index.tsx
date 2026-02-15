import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';

export default function Dashboard() {
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [stats, setStats] = useState({ leads: 0, calls: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('callx-auth');
      if (saved === '1') setAuthed(true);
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    Promise.all([
      axios.get('/api/leads'),
      axios.get('/api/calls')
    ]).then(([l, c]) => {
      setStats({ leads: l.data.total, calls: c.data.total });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [authed]);

  const checkPin = () => {
    if (pin === '0524') {
      sessionStorage.setItem('callx-auth', '1');
      setAuthed(true);
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

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

  return (
    <div className="min-h-screen bg-av-blue-bg">
      <header className="bg-av-navy text-white">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-av-orange rounded-lg flex items-center justify-center text-xl font-bold">C</div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">CallX OS</h1>
              <p className="text-blue-300 text-xs">by Angloville</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-xs font-medium">● Live</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Leady</div>
            <div className="text-3xl font-bold text-av-navy mt-1">{loading ? '—' : stats.leads}</div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Połączenia</div>
            <div className="text-3xl font-bold text-av-navy mt-1">{loading ? '—' : stats.calls}</div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Konwersja</div>
            <div className="text-3xl font-bold text-av-blue mt-1">
              {loading ? '—' : stats.calls > 0 ? Math.round((stats.calls / stats.leads) * 100) + '%' : '0%'}
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Śr. czas</div>
            <div className="text-3xl font-bold text-av-navy mt-1">—</div>
          </div>
        </div>

        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Szybkie akcje</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link href="/leads" className="group bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:border-av-blue hover:shadow-md">
            <div className="w-12 h-12 bg-av-blue/10 rounded-lg flex items-center justify-center text-2xl mb-3 group-hover:bg-av-blue/20">📞</div>
            <h3 className="font-semibold text-av-navy">Leady</h3>
            <p className="text-gray-500 text-sm mt-1">Przeglądaj i dzwoń do {stats.leads} leadów</p>
          </Link>
          <Link href="/calls" className="group bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:border-av-blue hover:shadow-md">
            <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center text-2xl mb-3 group-hover:bg-green-100">📊</div>
            <h3 className="font-semibold text-av-navy">Historia połączeń</h3>
            <p className="text-gray-500 text-sm mt-1">Przeglądaj historię i transkrypty</p>
          </Link>
          <Link href="/training" className="group bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:border-av-orange hover:shadow-md">
            <div className="w-12 h-12 bg-av-orange/10 rounded-lg flex items-center justify-center text-2xl mb-3 group-hover:bg-av-orange/20">📁</div>
            <h3 className="font-semibold text-av-navy">Dane treningowe</h3>
            <p className="text-gray-500 text-sm mt-1">Załaduj nagrania rozmów</p>
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-av-navy mb-4">Ostatnia aktywność</h2>
          <div className="text-gray-400 text-center py-12">
            <div className="text-4xl mb-3">📞</div>
            <p>Brak połączeń — zacznij od sekcji Leady</p>
          </div>
        </div>
      </main>
    </div>
  );
}
