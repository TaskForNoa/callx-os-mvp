import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';

interface Lead {
  customer_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  past_programs: string[];
  status: string;
}

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, calls: 0 });

  useEffect(() => {
    Promise.all([
      axios.get('/api/leads'),
      axios.get('/api/calls')
    ]).then(([leadsRes, callsRes]) => {
      setLeads(leadsRes.data.leads);
      setStats({
        total: leadsRes.data.total,
        calls: callsRes.data.total
      });
      setLoading(false);
    }).catch(err => {
      console.error('Error loading data:', err);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">CallX OS</h1>
          <p className="text-gray-600 mt-1">AI Voice Calling System - MVP Prototype</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm text-gray-600">Total Leads</div>
            <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm text-gray-600">Total Calls</div>
            <div className="text-3xl font-bold text-gray-900">{stats.calls}</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm text-gray-600">Conversion</div>
            <div className="text-3xl font-bold text-gray-900">
              {stats.calls > 0 ? Math.round((stats.calls / stats.total) * 100) : 0}%
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold">📋 Recent Activity</h2>
          </div>
          <div className="p-6">
            <div className="text-gray-500 text-center py-8">
              {stats.calls === 0 ? 'No calls yet - start calling from Leads!' : 'View Call Logs for details'}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link 
            href="/leads" 
            className="bg-blue-600 hover:bg-blue-700 text-white p-6 rounded-lg shadow text-center font-semibold transition transform hover:scale-105"
          >
            <div className="text-3xl mb-2">📞</div>
            <div>View All Leads</div>
          </Link>
          <Link 
            href="/calls" 
            className="bg-green-600 hover:bg-green-700 text-white p-6 rounded-lg shadow text-center font-semibold transition transform hover:scale-105"
          >
            <div className="text-3xl mb-2">📊</div>
            <div>Call Logs</div>
          </Link>
          <div className="bg-gray-300 text-gray-600 p-6 rounded-lg shadow text-center font-semibold cursor-not-allowed">
            <div className="text-3xl mb-2">📁</div>
            <div>Training Data</div>
            <div className="text-sm mt-1">(Coming Soon)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
