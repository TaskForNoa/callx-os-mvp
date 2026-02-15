import { useEffect, useState, useRef, useCallback } from 'react';
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

interface TranscriptMessage {
  speaker: 'agent' | 'customer';
  text: string;
  timestamp: number;
}

export default function LeadDetail() {
  const router = useRouter();
  const { id } = router.query;

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [voice, setVoice] = useState('Kasia');
  const [scenario, setScenario] = useState('Paści - Early Bird Junior');

  // Call state
  const [callActive, setCallActive] = useState(false);
  const [callStep, setCallStep] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Audio refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    axios.get(`/api/leads/${id}`).then(res => {
      setLead(res.data.lead);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const addToTranscript = useCallback((speaker: 'agent' | 'customer', text: string) => {
    setTranscript(prev => [...prev, { speaker, text, timestamp: Date.now() }]);
  }, []);

  // Synthesize and play agent voice
  const speakAgent = useCallback(async (text: string): Promise<void> => {
    setIsAgentSpeaking(true);
    setStatusText('🗣️ Kasia mówi...');
    addToTranscript('agent', text);

    try {
      const res = await axios.post('/api/voice/synthesize', { text, voice });

      if (res.data.success && res.data.audio) {
        const audioBlob = new Blob(
          [Uint8Array.from(atob(res.data.audio), c => c.charCodeAt(0))],
          { type: 'audio/mpeg' }
        );
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);

        await new Promise<void>((resolve) => {
          audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            resolve();
          };
          audio.onerror = () => {
            URL.revokeObjectURL(audioUrl);
            resolve();
          };
          audio.play().catch(() => resolve());
        });
      }
    } catch (err: any) {
      console.error('Speech synthesis error:', err);
      setError('Voice synthesis failed - continuing with text only');
    }

    setIsAgentSpeaking(false);
  }, [voice, addToTranscript]);

  // Record user audio and transcribe
  const listenToCustomer = useCallback(async (): Promise<string> => {
    setIsListening(true);
    setStatusText('🎤 Twoja kolej - mów...');

    return new Promise<string>(async (resolve) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach(track => track.stop());
          setIsListening(false);
          setIsProcessing(true);
          setStatusText('⏳ Przetwarzam...');

          try {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const reader = new FileReader();

            reader.onloadend = async () => {
              const base64 = (reader.result as string).split(',')[1];

              try {
                const res = await axios.post('/api/voice/transcribe', { audio: base64 });
                const text = res.data.transcript || '';
                setIsProcessing(false);

                if (text) {
                  addToTranscript('customer', text);
                  resolve(text);
                } else {
                  addToTranscript('customer', '(nie rozpoznano mowy)');
                  resolve('');
                }
              } catch (err) {
                console.error('Transcription error:', err);
                setIsProcessing(false);
                addToTranscript('customer', '(błąd transkrypcji)');
                resolve('');
              }
            };

            reader.readAsDataURL(audioBlob);
          } catch (err) {
            console.error('Audio processing error:', err);
            setIsProcessing(false);
            resolve('');
          }
        };

        mediaRecorder.start();

        // Auto-stop after 15 seconds or manual stop
        setTimeout(() => {
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
        }, 15000);

      } catch (err: any) {
        console.error('Microphone error:', err);
        setIsListening(false);
        setError('Nie mogę uzyskać dostępu do mikrofonu. Sprawdź uprawnienia przeglądarki.');
        resolve('');
      }
    });
  }, [addToTranscript]);

  // Stop recording manually
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // Main conversation loop
  const runConversation = useCallback(async () => {
    if (!lead) return;

    setCallActive(true);
    setTranscript([]);
    setOutcome(null);
    setError(null);
    setCallStep(0);

    let currentStep = 0;
    let history: TranscriptMessage[] = [];

    // Step 0: Agent greeting (no customer input needed first)
    while (currentStep !== 99) {
      try {
        // Get agent response
        const convRes = await axios.post('/api/conversation', {
          customer_id: lead.customer_id,
          step: currentStep,
          customerResponse: history.length > 0 ? history[history.length - 1]?.text || '' : '',
          history,
        });

        const { agentText, nextStep, outcome: callOutcome, isComplete } = convRes.data;

        if (agentText) {
          await speakAgent(agentText);
          history.push({ speaker: 'agent', text: agentText, timestamp: Date.now() });
        }

        if (isComplete || nextStep === 99) {
          setOutcome(callOutcome || 'Completed');
          setCallStep(99);
          break;
        }

        currentStep = nextStep;
        setCallStep(currentStep);

        // Listen to customer
        const customerText = await listenToCustomer();
        if (customerText) {
          history.push({ speaker: 'customer', text: customerText, timestamp: Date.now() });
        }

      } catch (err: any) {
        console.error('Conversation error:', err);
        setError('Błąd w trakcie rozmowy: ' + (err.message || 'Unknown error'));
        break;
      }
    }

    setCallActive(false);
    setStatusText('');
  }, [lead, speakAgent, listenToCustomer]);

  // End call manually
  const endCall = useCallback(() => {
    stopRecording();
    setCallActive(false);
    setIsAgentSpeaking(false);
    setIsListening(false);
    setIsProcessing(false);
    setStatusText('');
    if (!outcome) setOutcome('Manually Ended');
  }, [stopRecording, outcome]);

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
          <Link href="/leads" className="text-blue-600">← Back to Leads</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Link href="/leads" className="text-blue-600 hover:text-blue-800 text-sm">← Back to Leads</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            {lead.first_name} {lead.last_name}
          </h1>
          <div className="text-gray-600">{lead.phone} • {lead.email}</div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Lead Info */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">📚 Past Programs</h2>
              <ul className="space-y-2">
                {lead.past_programs.map((p, i) => (
                  <li key={i} className="text-gray-700">• {p}</li>
                ))}
              </ul>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-blue-900">🎯 Recommended</h2>
              <div className="text-xl font-bold text-blue-900 mt-1">
                Early Bird Junior {lead.preferred_destination} 2026
              </div>
              <div className="text-sm text-gray-700 mt-1">
                Cena Early Bird: 4 449 zł (zamiast 4 699 zł)
              </div>
            </div>

            {/* Transcript */}
            {transcript.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">📝 Transcript</h2>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {transcript.map((msg, i) => (
                    <div key={i} className={`flex ${msg.speaker === 'agent' ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        msg.speaker === 'agent'
                          ? 'bg-blue-100 text-blue-900'
                          : 'bg-green-100 text-green-900'
                      }`}>
                        <div className="text-xs font-medium mb-1">
                          {msg.speaker === 'agent' ? '🤖 Kasia (AI)' : '👤 Klient'}
                        </div>
                        <div className="text-sm">{msg.text}</div>
                      </div>
                    </div>
                  ))}
                  <div ref={transcriptEndRef} />
                </div>
              </div>
            )}
          </div>

          {/* Right: Call Controls */}
          <div>
            <div className="bg-white rounded-lg shadow p-6 sticky top-8">
              <h2 className="text-lg font-semibold mb-6">🎙️ Voice Call</h2>

              {/* Voice & Scenario */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Voice</label>
                <select
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                  disabled={callActive}
                >
                  <option value="Kasia">Kasia (Female)</option>
                  <option value="Marek">Marek (Male)</option>
                </select>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Scenario</label>
                <select
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                  disabled={callActive}
                >
                  <option value="Paści - Early Bird Junior">Paści - Early Bird Junior</option>
                </select>
              </div>

              {/* Call Button */}
              {!callActive ? (
                <button
                  onClick={runConversation}
                  className="w-full py-4 rounded-lg font-semibold text-white text-lg bg-green-600 hover:bg-green-700 transition transform hover:scale-105"
                >
                  🎙️ Start Call
                </button>
              ) : (
                <div className="space-y-4">
                  {/* Status indicator */}
                  <div className={`text-center py-4 rounded-lg font-semibold text-lg ${
                    isAgentSpeaking ? 'bg-blue-100 text-blue-800 animate-pulse' :
                    isListening ? 'bg-red-100 text-red-800 animate-pulse' :
                    isProcessing ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {statusText || 'Rozmowa w toku...'}
                  </div>

                  {/* Stop recording button (when listening) */}
                  {isListening && (
                    <button
                      onClick={stopRecording}
                      className="w-full py-3 rounded-lg font-semibold text-white bg-red-500 hover:bg-red-600 transition animate-pulse"
                    >
                      ⏹️ Stop Recording (lub poczekaj 15s)
                    </button>
                  )}

                  {/* End call button */}
                  <button
                    onClick={endCall}
                    className="w-full py-3 rounded-lg font-semibold text-red-600 border-2 border-red-600 hover:bg-red-50 transition"
                  >
                    📞 End Call
                  </button>
                </div>
              )}

              {/* Outcome */}
              {outcome && (
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-sm font-medium text-green-900">✅ Call Complete</div>
                  <div className="text-lg font-bold text-green-800 mt-1">{outcome}</div>
                  <div className="text-sm text-gray-600 mt-2">
                    Messages: {transcript.length} • Step: {callStep}
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="text-sm text-red-800">⚠️ {error}</div>
                </div>
              )}

              {/* Instructions */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
                <div className="font-medium mb-2">💡 Jak to działa:</div>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Kliknij "Start Call" - Kasia się przywitania</li>
                  <li>Po jej wypowiedzi - mikrofon się włączy</li>
                  <li>Mów swoją odpowiedź (max 15s)</li>
                  <li>Kliknij "Stop Recording" gdy skończysz</li>
                  <li>Kasia odpowie na podstawie Twojej odpowiedzi</li>
                  <li>Rozmowa trwa 5-7 wymian</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
