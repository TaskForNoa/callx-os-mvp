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
}

export default function LeadDetail() {
  const router = useRouter();
  const { id } = router.query;

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [voice, setVoice] = useState('Kasia');

  // Call state
  const [callActive, setCallActive] = useState(false);
  const [callStep, setCallStep] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'agent-speaking' | 'listening' | 'processing'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [silenceTimer, setSilenceTimer] = useState(0);

  // Refs for cleanup
  const abortRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    axios.get(`/api/leads/${id}`).then(res => {
      setLead(res.data.lead);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current = true;
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }
  };

  const addMsg = (speaker: 'agent' | 'customer', text: string) => {
    setTranscript(prev => [...prev, { speaker, text }]);
  };

  // ── Speak (ElevenLabs) ──
  const speak = async (text: string): Promise<void> => {
    if (abortRef.current) return;
    setPhase('agent-speaking');
    addMsg('agent', text);

    try {
      const controller = new AbortController();
      // Store controller so endCall can abort the fetch
      const checkAbort = setInterval(() => {
        if (abortRef.current) controller.abort();
      }, 100);

      const res = await axios.post('/api/voice/synthesize', { text, voice }, {
        signal: controller.signal
      });
      clearInterval(checkAbort);
      if (abortRef.current) return;

      if (res.data.success && res.data.audio) {
        const bytes = Uint8Array.from(atob(res.data.audio), c => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;

        await new Promise<void>(resolve => {
          audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
          audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
          // Check abort during playback
          const playAbortCheck = setInterval(() => {
            if (abortRef.current) {
              clearInterval(playAbortCheck);
              audio.pause();
              URL.revokeObjectURL(url);
              resolve();
            }
          }, 100);
          audio.onended = () => { clearInterval(playAbortCheck); URL.revokeObjectURL(url); resolve(); };
          audio.onerror = () => { clearInterval(playAbortCheck); URL.revokeObjectURL(url); resolve(); };
          audio.play().catch(() => { clearInterval(playAbortCheck); resolve(); });
        });
        audioRef.current = null;
      }
    } catch (err: any) {
      if (!abortRef.current) console.error('TTS error:', err);
    }
  };

  // ── Listen with VAD (auto-stop on silence) ──
  const listen = (): Promise<string> => {
    return new Promise(async (resolve) => {
      if (abortRef.current) { resolve(''); return; }
      setPhase('listening');
      setSilenceTimer(0);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        // Setup audio analyser for VAD
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        analyserRef.current = analyser;

        const recorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus' : 'audio/webm'
        });
        mediaRecorderRef.current = recorder;
        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = async () => {
          stream.getTracks().forEach(t => t.stop());
          streamRef.current = null;
          audioCtx.close();
          if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);

          if (abortRef.current || chunks.length === 0) { resolve(''); return; }

          setPhase('processing');
          try {
            const blob = new Blob(chunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onloadend = async () => {
              const b64 = (reader.result as string).split(',')[1];
              try {
                const res = await axios.post('/api/voice/transcribe', { audio: b64 });
                const text = res.data.transcript || '';
                if (text) addMsg('customer', text);
                resolve(text);
              } catch {
                resolve('');
              }
            };
            reader.readAsDataURL(blob);
          } catch {
            resolve('');
          }
        };

        recorder.start(250); // collect every 250ms

        // VAD: detect silence using RMS (root mean square) of time-domain data
        let speechDetected = false;
        let silentFrames = 0;
        const SILENCE_FRAMES_TO_STOP = 6; // 6 * 200ms = 1.2s silence after speech
        let tickCount = 0;

        const vadInterval = setInterval(() => {
          if (abortRef.current) {
            clearInterval(vadInterval);
            if (recorder.state === 'recording') recorder.stop();
            return;
          }
          if (recorder.state !== 'recording') { clearInterval(vadInterval); return; }

          // Use time-domain data (waveform) for better voice detection
          const bufferLength = analyser.fftSize;
          const data = new Float32Array(bufferLength);
          analyser.getFloatTimeDomainData(data);

          // Calculate RMS (root mean square) - better than frequency average
          let sumSquares = 0;
          for (let i = 0; i < bufferLength; i++) {
            sumSquares += data[i] * data[i];
          }
          const rms = Math.sqrt(sumSquares / bufferLength);

          // RMS > 0.01 = speech detected (very sensitive)
          const isSpeech = rms > 0.01;

          if (isSpeech) {
            speechDetected = true;
            silentFrames = 0;
          } else if (speechDetected) {
            silentFrames++;
            if (silentFrames >= SILENCE_FRAMES_TO_STOP) {
              clearInterval(vadInterval);
              if (recorder.state === 'recording') recorder.stop();
              return;
            }
          }

          tickCount++;
          setSilenceTimer(Math.floor(tickCount / 5)); // ~200ms interval → seconds

          // Hard limit: 15 seconds
          if (tickCount > 75) { // 75 * 200ms = 15s
            clearInterval(vadInterval);
            if (recorder.state === 'recording') recorder.stop();
          }
        }, 200);

      } catch (err: any) {
        setError('Brak dostępu do mikrofonu. Zezwól w przeglądarce!');
        resolve('');
      }
    });
  };

  // ── Stop recording manually ──
  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  // ── End call ──
  const endCall = () => {
    // Set abort flag FIRST
    abortRef.current = true;
    
    // Force stop everything
    cleanup();
    
    // Force UI reset
    setCallActive(false);
    setPhase('idle');
    if (!outcome) setOutcome('Ręcznie zakończono');
    
    // Reset abort for next call after a delay
    setTimeout(() => { abortRef.current = false; }, 500);
  };

  // ── Main conversation loop ──
  const startCall = async () => {
    if (!lead) return;
    abortRef.current = false;
    setCallActive(true);
    setTranscript([]);
    setOutcome(null);
    setError(null);
    setCallStep(0);

    let step = 0;
    let lastCustomerText = '';

    while (step !== 99 && !abortRef.current) {
      try {
        // Get agent response
        const res = await axios.post('/api/conversation', {
          customer_id: lead.customer_id,
          step,
          customerResponse: lastCustomerText,
        });

        if (abortRef.current) break;

        const { agentText, nextStep, outcome: o, isComplete } = res.data;

        if (agentText) {
          await speak(agentText);
        }

        if (abortRef.current) break;

        if (isComplete || nextStep === 99) {
          setOutcome(o || 'Zakończono');
          setCallStep(99);
          break;
        }

        step = nextStep;
        setCallStep(step);

        // Listen
        lastCustomerText = await listen();

        if (abortRef.current) break;

      } catch (err: any) {
        if (!abortRef.current) {
          setError('Błąd rozmowy: ' + (err.message || ''));
        }
        break;
      }
    }

    if (!abortRef.current) {
      setCallActive(false);
      setPhase('idle');
    }
  };

  // ── RENDER ──
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
        <Link href="/leads" className="text-blue-600">← Lead not found</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Link href="/leads" className="text-blue-600 text-sm">← Leads</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            {lead.first_name} {lead.last_name}
          </h1>
          <div className="text-gray-500 text-sm">{lead.phone} • {lead.email}</div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Left: Info (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-lg shadow p-5">
              <h2 className="font-semibold mb-3">📚 Programy</h2>
              {lead.past_programs.map((p, i) => (
                <div key={i} className="text-gray-700 text-sm">• {p}</div>
              ))}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
              <h2 className="font-semibold text-blue-900">🎯 Rekomendacja</h2>
              <div className="text-lg font-bold text-blue-900 mt-1">
                Junior {lead.preferred_destination} 2026
              </div>
              <div className="text-sm text-blue-700">Early Bird: 4 449 zł</div>
            </div>

            {/* Instructions */}
            <div className="bg-gray-100 rounded-lg p-5 text-sm text-gray-600">
              <div className="font-medium mb-2">💡 Jak to działa:</div>
              <ol className="list-decimal list-inside space-y-1">
                <li>Kliknij <b>"Start Call"</b></li>
                <li>Kasia się odezwie głosem</li>
                <li>Mikrofon włączy się automatycznie</li>
                <li>Mów swoją odpowiedź</li>
                <li><b>Auto-stop</b> gdy przestaniesz mówić (~2s ciszy)</li>
                <li>Lub kliknij "Stop" ręcznie</li>
                <li>Rozmowa: 5-7 wymian</li>
              </ol>
            </div>
          </div>

          {/* Right: Call + Transcript (3 cols) */}
          <div className="lg:col-span-3 space-y-4">

            {/* Call controls */}
            <div className="bg-white rounded-lg shadow p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg">🎙️ Voice Call</h2>
                {callActive && (
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    phase === 'agent-speaking' ? 'bg-blue-100 text-blue-800' :
                    phase === 'listening' ? 'bg-red-100 text-red-800' :
                    phase === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {phase === 'agent-speaking' ? '🗣️ Kasia mówi...' :
                     phase === 'listening' ? `🎤 Nagrywam... (${silenceTimer}s)` :
                     phase === 'processing' ? '⏳ Przetwarzam...' : ''}
                  </span>
                )}
              </div>

              {/* Voice selector */}
              <div className="flex gap-3 mb-4">
                <select
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                  className="border rounded px-3 py-2 text-sm flex-1"
                  disabled={callActive}
                >
                  <option value="Kasia">Kasia (Female)</option>
                  <option value="Marek">Marek (Male)</option>
                </select>
                <div className="border rounded px-3 py-2 text-sm text-gray-500 flex-1">
                  Paści - Early Bird Junior
                </div>
              </div>

              {/* Buttons */}
              {!callActive ? (
                <button
                  onClick={startCall}
                  className="w-full py-4 rounded-lg font-bold text-white text-lg bg-green-600 hover:bg-green-700 transition"
                >
                  🎙️ Start Call
                </button>
              ) : (
                <div className="flex gap-3">
                  {phase === 'listening' && (
                    <button
                      onClick={stopRecording}
                      className="flex-1 py-3 rounded-lg font-bold text-white bg-orange-500 hover:bg-orange-600 transition animate-pulse"
                    >
                      ⏹️ Stop Recording
                    </button>
                  )}
                  <button
                    onClick={endCall}
                    className={`${phase === 'listening' ? 'flex-1' : 'w-full'} py-3 rounded-lg font-bold text-white bg-red-600 hover:bg-red-700 transition`}
                  >
                    📞 Zakończ
                  </button>
                </div>
              )}

              {/* Outcome */}
              {outcome && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <span className="font-bold text-green-800">✅ {outcome}</span>
                  <span className="text-sm text-gray-500 ml-2">({transcript.length} wiadomości)</span>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                  ⚠️ {error}
                </div>
              )}
            </div>

            {/* Transcript */}
            <div className="bg-white rounded-lg shadow p-5">
              <h2 className="font-semibold mb-3">📝 Transcript</h2>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {transcript.length === 0 && (
                  <div className="text-gray-400 text-center py-8">
                    Kliknij "Start Call" aby rozpocząć rozmowę
                  </div>
                )}
                {transcript.map((msg, i) => (
                  <div key={i} className={`flex ${msg.speaker === 'agent' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                      msg.speaker === 'agent'
                        ? 'bg-blue-100 text-blue-900 rounded-bl-sm'
                        : 'bg-green-100 text-green-900 rounded-br-sm'
                    }`}>
                      <div className="text-[11px] font-medium opacity-60 mb-0.5">
                        {msg.speaker === 'agent' ? '🤖 Kasia' : '👤 Ty'}
                      </div>
                      <div className="text-sm">{msg.text}</div>
                    </div>
                  </div>
                ))}
                <div ref={transcriptEndRef} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
