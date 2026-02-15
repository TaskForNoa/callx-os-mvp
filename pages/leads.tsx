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

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    axios.get('/api/leads').then(r => {
      setLeads(r.data.leads);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = leads.filter(l =>
    `${l.first_name} ${l.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    l.phone.includes(search)
  );

  return (
    <div className="min-h-screen bg-av-blue-bg">
      {/* Header */}
      <header className="bg-av-navy text-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-blue-300 hover:text-white text-sm">← Dashboard</Link>
            <h1 className="text-lg font-bold">Leads ({filtered.length})</h1>
          </div>
          <input
            type="text"
            placeholder="🔍 Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm text-white placeholder-blue-300 w-64 focus:outline-none focus:border-av-blue"
          />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        {loading ? (
          <div className="text-center py-20 text-gray-500">Loading...</div>
        ) : (
          <div className="grid gap-3">
            {filtered.map(lead => (
              <Link
                key={lead.customer_id}
                href={`/leads/${lead.customer_id}`}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:border-av-blue hover:shadow-md flex items-center justify-between group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-av-blue/10 rounded-full flex items-center justify-center text-av-blue font-bold text-sm">
                    {lead.first_name[0]}{lead.last_name[0]}
                  </div>
                  <div>
                    <div className="font-semibold text-av-navy">{lead.first_name} {lead.last_name}</div>
                    <div className="text-gray-500 text-sm">{lead.phone}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden md:block">
                    <div className="text-xs text-gray-500">{lead.past_programs.length} program(s)</div>
                    <div className="text-xs text-gray-400">{lead.past_programs[lead.past_programs.length - 1]}</div>
                  </div>
                  <span className="px-2 py-1 bg-av-blue/10 text-av-blue text-xs font-medium rounded-full">
                    {lead.status}
                  </span>
                  <span className="text-gray-300 group-hover:text-av-blue">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
