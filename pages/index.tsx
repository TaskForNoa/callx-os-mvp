import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';

export default function Dashboard() {
  const [stats, setStats] = useState({ leads: 0, calls: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      axios.get('/api/leads'),
      axios.get('/api/calls')
    ]).then(([l, c]) => {
      setStats({ leads: l.data.total, calls: c.data.total });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold text-av-navy mb-6">Dashboard</h1>
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
        <Link href="/scenarios" className="group bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:border-av-blue hover:shadow-md">
          <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-2xl mb-3 group-hover:bg-blue-100">🎬</div>
          <h3 className="font-semibold text-av-navy">Scenariusze</h3>
          <p className="text-gray-500 text-sm mt-1">Zarządzaj scenariuszami rozmów</p>
        </Link>
        <Link href="/products" className="group bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:border-av-orange hover:shadow-md">
          <div className="w-12 h-12 bg-av-orange/10 rounded-lg flex items-center justify-center text-2xl mb-3 group-hover:bg-av-orange/20">🏷️</div>
          <h3 className="font-semibold text-av-navy">Produkty</h3>
          <p className="text-gray-500 text-sm mt-1">Baza produktów Angloville</p>
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
  );
}
