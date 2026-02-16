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
  leadType: 'pasti' | 'new';
  recommendedProgram?: string;
  outcome?: string | null;
}

const outcomeLabels: Record<string, { icon: string; label: string; color: string }> = {
  'aplikacja': { icon: '✅', label: 'Aplikacja', color: 'bg-green-50 text-green-700' },
  'link_wyslany': { icon: '📧', label: 'Link wysłany', color: 'bg-blue-50 text-blue-700' },
  'callback': { icon: '📅', label: 'Callback', color: 'bg-yellow-50 text-yellow-700' },
  'odmowa': { icon: '❌', label: 'Odmowa', color: 'bg-red-50 text-red-700' },
  'nie_odebrano': { icon: '📞', label: 'Nie odebrano', color: 'bg-gray-50 text-gray-500' },
  'eskalacja': { icon: '⬆️', label: 'Eskalacja', color: 'bg-purple-50 text-purple-700' },
};

type FilterType = 'all' | 'pasti' | 'new';

type LeadSegment = 'Past Junior' | 'Past Kids' | 'Past Adult' | 'Past' | 'Nowy';

function detectPastSegment(pastPrograms: string[] = []): LeadSegment {
  const t = pastPrograms.join(' ').toLowerCase();
  if (t.includes('kids')) return 'Past Kids';
  if (t.includes('junior') || t.includes('malta') || t.includes('anglia') || t.includes('eurotrip') || t.includes('uk trip')) return 'Past Junior';
  if (t.includes('adult') || t.includes('wioska') || t.includes('tandem') || t.includes('premium')) return 'Past Adult';
  return 'Past';
}

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  useEffect(() => {
    axios.get('/api/leads').then(r => {
      setLeads(r.data.leads);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = leads.filter(l => {
    const matchSearch = `${l.first_name} ${l.last_name}`.toLowerCase().includes(search.toLowerCase()) || l.phone.includes(search);
    const matchFilter = filter === 'all' || l.leadType === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-av-navy">Leady ({filtered.length})</h1>
        <input
          type="text"
          placeholder="🔍 Szukaj..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-4 py-2 text-sm w-64 focus:outline-none focus:border-av-blue"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {([['all', 'Wszystkie'], ['pasti', '🔄 Paści'], ['new', '🆕 Nowy lead']] as [FilterType, string][]).map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === val ? 'bg-av-blue text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-av-blue'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-500">Ładowanie...</div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(lead => {
            const oc = lead.outcome ? outcomeLabels[lead.outcome] : null;
            return (
              <Link key={lead.customer_id} href={`/leads/${lead.customer_id}`}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:border-av-blue hover:shadow-md flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-av-blue/10 rounded-full flex items-center justify-center text-av-blue font-bold text-sm">
                    {lead.first_name[0]}{lead.last_name[0]}
                  </div>
                  <div>
                    <div className="font-semibold text-av-navy flex items-center gap-2">
                      {lead.first_name} {lead.last_name}
                      {(() => {
                        const seg = lead.leadType === 'pasti' ? detectPastSegment(lead.past_programs) : 'Nowy';
                        const style = seg === 'Nowy'
                          ? 'bg-green-100 text-green-700'
                          : seg === 'Past Kids'
                            ? 'bg-amber-100 text-amber-700'
                            : seg === 'Past Junior'
                              ? 'bg-blue-100 text-blue-700'
                              : seg === 'Past Adult'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-gray-100 text-gray-700';
                        const label = seg === 'Nowy' ? '🆕 NOWY' : `🔄 ${seg.toUpperCase()}`;
                        return (
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${style}`}>
                            {label}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="text-gray-500 text-sm">{lead.phone}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {lead.recommendedProgram && (
                    <div className="text-right hidden md:block">
                      <div className="text-xs text-gray-500">Rekomendacja</div>
                      <div className="text-xs text-av-blue font-medium">{lead.recommendedProgram}</div>
                    </div>
                  )}
                  {oc ? (
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${oc.color}`}>
                      {oc.icon} {oc.label}
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-gray-50 text-gray-400 text-xs font-medium rounded-full">
                      Brak kontaktu
                    </span>
                  )}
                  <span className="text-gray-300 group-hover:text-av-blue">→</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
