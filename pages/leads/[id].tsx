import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/router';

interface Lead {
  customer_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  past_programs: string[];
  preferred_destination: string;
  has_siblings: boolean;
  last_contact_date: string;
}

interface Call {
  call_id: string;
  started_at: string;
  duration: number;
  outcome: string;
  status: string;
  transcript?: Array<{ speaker: string; text: string; timestamp: number }>;
}

export default function LeadDetail() {
  const router = useRouter();
  const { id } = router.query;
  
  const [lead, setLead] = useState<Lead | null>(null);
  const [callHistory, setCallHistory] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState(false);
  const [voice, setVoice] = useState('Kasia');
  const [scenario, setScenario] = useState('Paści - Early Bird Junior');
  const [currentCall, setCurrentCall] = useState<Call | null>(null);

  useEffect(() => {
    if (!id) return;
    
    axios.get(`/api/leads/${id}`).then(res => {
      setLead(res.data.lead);
      setCallHistory(res.data.callHistory);
      setLoading(false);
    }).catch(err => {
      console.error('Error loading lead:', err);
      setLoading(false);
    });
  }, [id]);

  const startCall = async () => {
    if (!lead) return;
    
    setCalling(true);
    try {
      const res = await axios.post('/api/calls', {
        customer_id: lead.customer_id,
        voice,
        scenario
      });
      
      setCurrentCall(res.data.call);
      setCalling(false);
      
      // Reload call history
      const historyRes = await axios.get(`/api/leads/${id}`);
      setCallHistory(historyRes.data.callHistory);
      
    } catch (error) {
      console.error('Call error:', error);
      setCalling(false);
      alert('Error starting call. Check console.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-xl text-gray-900 mb-4">Lead not found</div>
          <Link href="/leads" className="text-blue-600 hover:text-blue-800">
            ← Back to Leads
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Link href="/leads" className="text-blue-600 hover:text-blue-800 text-sm">
            ← Back to Leads
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            {lead.first_name} {lead.last_name}
          </h1>
          <div className="text-gray-600">{lead.phone}</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Lead Info */}
          <div className="space-y-6">
            {/* Past Programs */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">📚 Past Programs</h2>
              <ul className="space-y-2">
                {lead.past_programs.map((program, i) => (
                  <li key={i} className="text-gray-700 flex items-start">
                    <span className="text-blue-600 mr-2">•</span>
                    {program}
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommended Program */}
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-2 text-blue-900">
                🎯 Recommended Program
              </h2>
              <div className="text-xl font-bold text-blue-900 mb-2">
                Early Bird Junior {lead.preferred_destination} 2026
              </div>
              <div className="text-sm text-gray-700">
                💡 Wybierał {lead.preferred_destination} wcześniej + Early Bird discount
              </div>
            </div>

            {/* Call History */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">📞 Call History</h2>
              {callHistory.length === 0 ? (
                <div className="text-gray-500 text-center py-4">No calls yet</div>
              ) : (
                <div className="space-y-3">
                  {callHistory.map(call => (
                    <div key={call.call_id} className="border-l-4 border-blue-500 pl-4 py-2 bg-gray-50 rounded">
                      <div className="text-sm text-gray-600">
                        {new Date(call.started_at).toLocaleString()}
                      </div>
                      <div className="font-medium">{call.status}</div>
                      {call.outcome && (
                        <div className="text-sm text-gray-600">Outcome: {call.outcome}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Call Controls */}
          <div>
            <div className="bg-white rounded-lg shadow p-6 sticky top-8">
              <h2 className="text-lg font-semibold mb-6">🎙️ Start Call</h2>
              
              {/* Voice Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🎭 Select Voice
                </label>
                <select
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={calling}
                >
                  <option value="Kasia">Kasia (Female, Friendly)</option>
                  <option value="Marek">Marek (Male, Professional)</option>
                </select>
              </div>

              {/* Scenario Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📞 Select Scenario
                </label>
                <select
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={calling}
                >
                  <option value="Paści - Early Bird Junior">Paści - Early Bird Junior</option>
                  <option value="Paści - General" disabled>Paści - General (Coming Soon)</option>
                </select>
              </div>

              {/* Start Call Button */}
              <button
                onClick={startCall}
                disabled={calling}
                className={`w-full py-4 rounded-lg font-semibold text-white text-lg transition transform ${
                  calling
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 hover:scale-105'
                }`}
              >
                {calling ? '🔊 Calling...' : '🎙️ Start Call'}
              </button>

              {/* Call Result */}
              {currentCall && (
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-sm font-medium text-green-900 mb-2">
                    ✅ Call Completed
                  </div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Status:</span>{' '}
                      <span className="text-green-700">{currentCall.status}</span>
                    </div>
                    <div>
                      <span className="font-medium">Duration:</span> {currentCall.duration}s
                    </div>
                    {currentCall.transcript && currentCall.transcript.length > 0 && (
                      <div className="mt-4">
                        <div className="font-medium mb-2">Transcript:</div>
                        <div className="space-y-2 max-h-64 overflow-y-auto bg-white p-3 rounded border">
                          {currentCall.transcript.map((msg, i) => (
                            <div key={i} className="text-sm">
                              <span className={`font-medium ${
                                msg.speaker === 'agent' ? 'text-blue-600' : 'text-gray-700'
                              }`}>
                                {msg.speaker === 'agent' ? '🤖' : '👤'} {msg.speaker}:
                              </span>{' '}
                              <span className="text-gray-700">{msg.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
