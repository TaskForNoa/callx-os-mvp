import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';

interface Lead {
  customer_id: string;
  first_name: string;
  last_name: string;
}

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
    <div className="min-h-screen bg-av-blue-bg">
      {/* Header */}
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
        {/* Stats row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Leads</div>
            <div className="text-3xl font-bold text-av-navy mt-1">{loading ? '—' : stats.leads}</div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Calls</div>
            <div className="text-3xl font-bold text-av-navy mt-1">{loading ? '—' : stats.calls}</div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Conversion</div>
            <div className="text-3xl font-bold text-av-blue mt-1">
              {loading ? '—' : stats.calls > 0 ? Math.round((stats.calls / stats.leads) * 100) + '%' : '0%'}
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Avg Duration</div>
            <div className="text-3xl font-bold text-av-navy mt-1">—</div>
          </div>
        </div>

        {/* Quick Actions */}
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link href="/leads" className="group bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:border-av-blue hover:shadow-md">
            <div className="w-12 h-12 bg-av-blue/10 rounded-lg flex items-center justify-center text-2xl mb-3 group-hover:bg-av-blue/20">📞</div>
            <h3 className="font-semibold text-av-navy">View Leads</h3>
            <p className="text-gray-500 text-sm mt-1">Browse and call {stats.leads} leads</p>
          </Link>
          <Link href="/calls" className="group bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:border-av-blue hover:shadow-md">
            <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center text-2xl mb-3 group-hover:bg-green-100">📊</div>
            <h3 className="font-semibold text-av-navy">Call Logs</h3>
            <p className="text-gray-500 text-sm mt-1">View call history & transcripts</p>
          </Link>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 opacity-50">
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-2xl mb-3">📁</div>
            <h3 className="font-semibold text-gray-400">Training Data</h3>
            <p className="text-gray-400 text-sm mt-1">Upload sales conversations</p>
            <span className="text-xs text-av-orange font-medium">Coming soon</span>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-av-navy mb-4">Recent Activity</h2>
          <div className="text-gray-400 text-center py-12">
            <div className="text-4xl mb-3">📞</div>
            <p>No calls yet — start from Leads page</p>
          </div>
        </div>
      </main>
    </div>
  );
}
