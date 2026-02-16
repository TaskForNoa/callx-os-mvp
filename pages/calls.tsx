import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';

interface Call {
  call_id: string;
  customer_name: string;
  phone: string;
  scenario: string;
  started_at: string;
  duration: number;
  status: string;
}

export default function CallLogs() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/calls').then(r => {
      setCalls(r.data.calls);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-av-navy mb-6">Połączenia ({calls.length})</h1>

      {loading ? (
        <div className="text-center py-20 text-gray-500">Ładowanie...</div>
      ) : calls.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-16 text-center">
          <div className="text-5xl mb-4">📞</div>
          <div className="text-gray-500 mb-2">Brak połączeń</div>
          <Link href="/leads" className="text-av-blue hover:underline font-medium text-sm">
            Przejdź do Leadów →
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {calls.map(call => (
            <div key={call.call_id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-3 h-3 rounded-full ${
                  call.status === 'completed' ? 'bg-green-400' :
                  call.status === 'calling' ? 'bg-yellow-400 animate-pulse' :
                  'bg-gray-300'
                }`} />
                <div>
                  <div className="font-semibold text-av-navy">{call.customer_name}</div>
                  <div className="text-gray-500 text-xs">{call.phone} • {call.scenario}</div>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="text-right">
                  <div className="text-gray-700">{call.duration}s</div>
                  <div className="text-gray-400 text-xs">{new Date(call.started_at).toLocaleString('pl-PL')}</div>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  call.status === 'completed' ? 'bg-green-50 text-green-700' :
                  call.status === 'calling' ? 'bg-yellow-50 text-yellow-700' :
                  'bg-gray-50 text-gray-700'
                }`}>
                  {call.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
