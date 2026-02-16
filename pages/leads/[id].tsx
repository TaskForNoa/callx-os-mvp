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
  leadType: 'pasti' | 'new';
  childName?: string;
  recommendedProgram?: string;
  recommendedReason?: string;
  outcome?: string | null;
}

interface Msg { speaker: 'agent' | 'customer'; text: string; }

const outcomes = [
  { key: 'aplikacja', icon: '✅', label: 'Aplikacja', desc: 'Agent wypełnił za klienta' },
  { key: 'link_wyslany', icon: '📧', label: 'Link wysłany', desc: 'Klient dostał link' },
  { key: 'callback', icon: '📅', label: 'Callback', desc: 'Umówiony ponowny kontakt' },
  { key: 'odmowa', icon: '❌', label: 'Odmowa', desc: 'Nie zainteresowany' },
  { key: 'nie_odebrano', icon: '📞', label: 'Nie odebrano', desc: 'Brak kontaktu' },
  { key: 'eskalacja', icon: '⬆️', label: 'Eskalacja', desc: 'Przekazano do człowieka' },
];

export default function LeadDetail() {
  const router = useRouter();
  const { id } = router.query;

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [voice, setVoice] = useState<'Karolina' | 'Kasia' | 'Marek'>('Karolina');
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);

  const [callActive, setCallActive] = useState(false);
  const [callStep, setCallStep] = useState(0);
  const [transcript, setTranscript] = useState<Msg[]>([]);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'agent-speaking' | 'listening' | 'processing'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [listenSec, setListenSec] = useState(0);

  const abortRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    axios.get(`/api/leads/${id}`).then(r => {
      setLead(r.data.lead);
      setSelectedOutcome(r.data.lead.outcome || null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [transcript]);
  useEffect(() => () => { abortRef.current = true; cleanup(); }, []);

  const cleanup = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
  };

  const addMsg = (s: 'agent' | 'customer', t: string) => setTranscript(p => [...p, { speaker: s, text: t }]);

  const speak = async (text: string) => {
    if (abortRef.current) return;
    setPhase('agent-speaking');
    addMsg('agent', text);
    try {
      const ctrl = new AbortController();
      const chk = setInterval(() => { if (abortRef.current) ctrl.abort(); }, 100);
      const res = await axios.post('/api/voice/synthesize', { text, voice }, { signal: ctrl.signal });
      clearInterval(chk);
      if (abortRef.current) return;
      if (res.data.success && res.data.audio) {
        const bytes = Uint8Array.from(atob(res.data.audio), c => c.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
        const audio = new Audio(url);
        audioRef.current = audio;
        await new Promise<void>(resolve => {
          const chk2 = setInterval(() => { if (abortRef.current) { clearInterval(chk2); audio.pause(); resolve(); } }, 100);
          audio.onended = () => { clearInterval(chk2); URL.revokeObjectURL(url); resolve(); };
          audio.onerror = () => { clearInterval(chk2); resolve(); };
          audio.play().catch(() => { clearInterval(chk2); resolve(); });
        });
        audioRef.current = null;
      }
    } catch {}
  };

  const listen = (): Promise<string> => new Promise(async (resolve) => {
    if (abortRef.current) { resolve(''); return; }
    setPhase('listening');
    setListenSec(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const ana = ctx.createAnalyser();
      ana.fftSize = 512;
      src.connect(ana);
      const rec = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
      });
      recorderRef.current = rec;
      const chunks: Blob[] = [];
      rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        ctx.close();
        if (abortRef.current || chunks.length === 0) { resolve(''); return; }
        setPhase('processing');
        try {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = async () => {
            const b64 = (reader.result as string).split(',')[1];
            try {
              const r = await axios.post('/api/voice/transcribe', { audio: b64 });
              const t = (r.data.transcript || '').trim();
              if (t) {
                addMsg('customer', t);
                resolve(t);
              } else {
                // Always show something in transcript so user knows we listened
                addMsg('customer', '(brak transkrypcji — spróbuj mówić bliżej mikrofonu)');
                resolve('');
              }
            } catch { resolve(''); }
          };
          reader.readAsDataURL(blob);
        } catch { resolve(''); }
      };
      // Smaller timeslice slightly reduces the perceived lag on some browsers
      rec.start(150);

      // Improved VAD (voice activity detection)
      // Issue you saw: the "~1s" stop worked only on the first turn, later turns fell back to max wait.
      // Root cause: if you start speaking during the initial calibration window, the noise floor gets inflated
      // → threshold too high → speech not detected → we wait until hard cap.
      // Fix: calibrate only on low-RMS frames (likely silence), and keep a conservative threshold.
      let spoke = false;
      let silentTicksAfterSpeech = 0;
      let ticks = 0;

      let floor = 0.003; // conservative default
      let floorSamples = 0;
      let dynamicThreshold = 0.008;

      const vad = setInterval(() => {
        if (abortRef.current) {
          clearInterval(vad);
          if (rec.state === 'recording') rec.stop();
          return;
        }
        if (rec.state !== 'recording') {
          clearInterval(vad);
          return;
        }

        const d = new Float32Array(ana.fftSize);
        ana.getFloatTimeDomainData(d);
        let s = 0;
        for (let i = 0; i < d.length; i++) s += d[i] * d[i];
        const rms = Math.sqrt(s / d.length);

        // Calibrate over ~1.2s but ONLY when it's quiet (so speech doesn't inflate the floor)
        if (!spoke && ticks < 6) {
          if (rms < 0.02) {
            // EMA toward observed quiet rms
            floor = floor * 0.85 + rms * 0.15;
            floorSamples += 1;
          }
          dynamicThreshold = Math.max(0.004, floor * 3.0);
        }

        const isSpeech = rms > dynamicThreshold;

        if (isSpeech) {
          spoke = true;
          silentTicksAfterSpeech = 0;
        } else if (spoke) {
          silentTicksAfterSpeech += 1;
          // Stop after ~1.2–1.4s of silence after user spoke (let user finish sentences)
          if (silentTicksAfterSpeech >= 7) {
            clearInterval(vad);
            if (rec.state === 'recording') rec.stop();
            return;
          }
        }

        ticks += 1;
        setListenSec(Math.floor(ticks / 5));

        // Hard cap: 10s — give user time to think and speak
        if (ticks > 50) {
          clearInterval(vad);
          if (rec.state === 'recording') rec.stop();
        }
      }, 200);
    } catch {
      setError('Brak mikrofonu — zezwól w przeglądarce!');
      resolve('');
    }
  });

  const stopRec = () => { if (recorderRef.current?.state === 'recording') recorderRef.current.stop(); };

  const endCall = () => {
    abortRef.current = true;
    cleanup();
    setCallActive(false);
    setPhase('idle');
    if (!outcome) setOutcome('Ręcznie zakończono');
    setTimeout(() => { abortRef.current = false; }, 500);
  };

  const startCall = async () => {
    if (!lead) return;
    abortRef.current = false;
    setCallActive(true);
    setTranscript([]);
    setOutcome(null);
    setError(null);
    setCallStep(0);
    let step = 0, lastText = '';
    while (step !== 99 && !abortRef.current) {
      try {
        const r = await axios.post('/api/conversation', { customer_id: lead.customer_id, step, customerResponse: lastText, voice });
        if (abortRef.current) break;
        if (r.data.agentText) await speak(r.data.agentText);
        if (abortRef.current) break;
        if (r.data.isComplete || r.data.nextStep === 99) { setOutcome(r.data.outcome || 'Zakończono'); break; }
        const next = r.data.nextStep;
        setCallStep(next);
        // Listen (retry once if STT returns empty)
        lastText = await listen();
        if (!abortRef.current && (!lastText || !lastText.trim())) {
          lastText = await listen();
        }
        step = next;
        if (abortRef.current) break;
      } catch (e: any) { if (!abortRef.current) setError(e.message); break; }
    }
    if (!abortRef.current) { setCallActive(false); setPhase('idle'); }
  };

  const saveOutcome = (key: string) => {
    setSelectedOutcome(key);
    // Save to localStorage
    if (lead) {
      const stored = JSON.parse(localStorage.getItem('callx-outcomes') || '{}');
      stored[lead.customer_id] = key;
      localStorage.setItem('callx-outcomes', JSON.stringify(stored));
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-av-blue-bg text-gray-500">Ładowanie...</div>;
  if (!lead) return <div className="min-h-screen flex items-center justify-center bg-av-blue-bg"><Link href="/leads" className="text-av-blue">← Lead nie znaleziony</Link></div>;

  return (
    <div className="min-h-screen bg-av-blue-bg">
      <header className="bg-av-navy text-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/leads" className="text-blue-300 hover:text-white text-sm">← Leady</Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold flex items-center gap-2">
              {lead.first_name} {lead.last_name}
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                lead.leadType === 'pasti' ? 'bg-blue-500/30 text-blue-200' : 'bg-green-500/30 text-green-200'
              }`}>
                {lead.leadType === 'pasti' ? '🔄 PAŚCI' : '🆕 NOWY'}
              </span>
            </h1>
            <p className="text-blue-300 text-xs">{lead.phone} • {lead.email}{lead.childName ? ` • Dziecko: ${lead.childName}` : ''}</p>
          </div>
          {callActive && (
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              phase === 'agent-speaking' ? 'bg-av-blue/30 text-blue-200' :
              phase === 'listening' ? 'bg-red-500/30 text-red-200 animate-pulse-record' :
              phase === 'processing' ? 'bg-av-orange/30 text-orange-200' :
              'bg-white/10 text-white/60'
            }`}>
              {phase === 'agent-speaking' ? `🗣️ ${voice} mówi...` :
               phase === 'listening' ? `🎤 ${listenSec}s` :
               phase === 'processing' ? '⏳ Przetwarzam...' : ''}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Info */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Wcześniejsze programy</h2>
              {lead.past_programs.length > 0 ? lead.past_programs.map((p, i) => (
                <div key={i} className="flex items-center gap-2 py-1">
                  <span className="w-2 h-2 bg-av-blue rounded-full"></span>
                  <span className="text-sm text-gray-700">{p}</span>
                </div>
              )) : (
                <p className="text-sm text-gray-400">Brak — nowy klient</p>
              )}
            </div>

            {/* AI Recommendation */}
            <div className="bg-gradient-to-br from-av-blue to-av-blue-dark rounded-xl p-5 text-white">
              <div className="text-xs uppercase tracking-wider opacity-80 mb-1">🤖 Rekomendacja AI</div>
              <div className="text-lg font-bold">{lead.recommendedProgram || 'Brak'}</div>
              {lead.recommendedReason && (
                <div className="text-sm opacity-80 mt-2 leading-relaxed">{lead.recommendedReason}</div>
              )}
            </div>

            {/* Outcome selector */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Wynik rozmowy</h2>
              <div className="grid grid-cols-2 gap-2">
                {outcomes.map(o => (
                  <button key={o.key} onClick={() => saveOutcome(o.key)}
                    className={`p-2 rounded-lg text-xs text-left border transition-all ${
                      selectedOutcome === o.key
                        ? 'border-av-blue bg-av-blue/10 ring-2 ring-av-blue/30'
                        : 'border-gray-200 hover:border-av-blue/50'
                    }`}>
                    <div className="font-medium">{o.icon} {o.label}</div>
                    <div className="text-gray-400 mt-0.5">{o.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Controls */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Ustawienia</h2>
              <select value={voice} onChange={e => setVoice(e.target.value as any)} disabled={callActive}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-av-blue">
                <option value="Karolina">🎭 Karolina (Sales)</option>
                <option value="Kasia">🎭 Kasia (Kobieta)</option>
                <option value="Marek">🎭 Marek (Mężczyzna)</option>
              </select>
              <div className="text-xs text-gray-400 px-1">Scenariusz: Re-engagement Paści</div>
            </div>
          </div>

          {/* Right: Call + Transcript */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              {!callActive ? (
                <button onClick={startCall}
                  className="w-full py-4 rounded-xl font-bold text-white text-lg bg-gradient-to-r from-av-blue to-av-blue-dark hover:shadow-lg hover:shadow-av-blue/30 transform hover:scale-[1.02]">
                  🎙️ Rozpocznij rozmowę
                </button>
              ) : (
                <div className="flex gap-3">
                  {phase === 'listening' && (
                    <button onClick={stopRec}
                      className="flex-1 py-3 rounded-xl font-bold text-white bg-av-orange hover:bg-orange-500 animate-pulse-record">
                      ⏹️ Stop
                    </button>
                  )}
                  <button onClick={endCall}
                    className={`${phase === 'listening' ? 'flex-1' : 'w-full'} py-3 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600`}>
                    📞 Zakończ
                  </button>
                </div>
              )}
              {outcome && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
                  <span className="text-2xl">✅</span>
                  <div>
                    <div className="font-bold text-green-800">{outcome}</div>
                    <div className="text-xs text-green-600">{transcript.length} wiadomości</div>
                  </div>
                </div>
              )}
              {error && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">⚠️ {error}</div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Transkrypt</h2>
              </div>
              <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto min-h-[200px]">
                {transcript.length === 0 && (
                  <div className="text-gray-300 text-center py-16 text-sm">
                    Kliknij "Rozpocznij rozmowę" aby zacząć
                  </div>
                )}
                {transcript.map((m, i) => (
                  <div key={i} className={`flex ${m.speaker === 'agent' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                      m.speaker === 'agent'
                        ? 'bg-av-blue/10 text-av-navy rounded-bl-md'
                        : 'bg-av-orange/10 text-gray-900 rounded-br-md'
                    }`}>
                      <div className="text-[10px] font-semibold uppercase tracking-wider opacity-50 mb-0.5">
                        {m.speaker === 'agent' ? `🤖 ${voice}` : '👤 Klient'}
                      </div>
                      <div className="text-sm leading-relaxed">{m.text}</div>
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
