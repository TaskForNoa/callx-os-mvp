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
}

interface Msg { speaker: 'agent' | 'customer'; text: string; }

export default function LeadDetail() {
  const router = useRouter();
  const { id } = router.query;

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [voice, setVoice] = useState('Kasia');

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
    axios.get(`/api/leads/${id}`).then(r => { setLead(r.data.lead); setLoading(false); }).catch(() => setLoading(false));
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

  // ── TTS ──
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

  // ── STT with VAD ──
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
              const t = r.data.transcript || '';
              if (t) addMsg('customer', t);
              resolve(t);
            } catch { resolve(''); }
          };
          reader.readAsDataURL(blob);
        } catch { resolve(''); }
      };
      rec.start(250);
      let spoke = false, silent = 0, ticks = 0;
      const vad = setInterval(() => {
        if (abortRef.current) { clearInterval(vad); if (rec.state === 'recording') rec.stop(); return; }
        if (rec.state !== 'recording') { clearInterval(vad); return; }
        const d = new Float32Array(ana.fftSize);
        ana.getFloatTimeDomainData(d);
        let s = 0; for (let i = 0; i < d.length; i++) s += d[i] * d[i];
        const rms = Math.sqrt(s / d.length);
        if (rms > 0.01) { spoke = true; silent = 0; }
        else if (spoke) { silent++; if (silent >= 6) { clearInterval(vad); if (rec.state === 'recording') rec.stop(); return; } }
        ticks++;
        setListenSec(Math.floor(ticks / 5));
        if (ticks > 75) { clearInterval(vad); if (rec.state === 'recording') rec.stop(); }
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
        const r = await axios.post('/api/conversation', { customer_id: lead.customer_id, step, customerResponse: lastText });
        if (abortRef.current) break;
        if (r.data.agentText) await speak(r.data.agentText);
        if (abortRef.current) break;
        if (r.data.isComplete || r.data.nextStep === 99) { setOutcome(r.data.outcome || 'Zakończono'); break; }
        step = r.data.nextStep;
        setCallStep(step);
        lastText = await listen();
        if (abortRef.current) break;
      } catch (e: any) { if (!abortRef.current) setError(e.message); break; }
    }
    if (!abortRef.current) { setCallActive(false); setPhase('idle'); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-av-blue-bg text-gray-500">Loading...</div>;
  if (!lead) return <div className="min-h-screen flex items-center justify-center bg-av-blue-bg"><Link href="/leads" className="text-av-blue">← Lead not found</Link></div>;

  return (
    <div className="min-h-screen bg-av-blue-bg">
      <header className="bg-av-navy text-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/leads" className="text-blue-300 hover:text-white text-sm">← Leads</Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold">{lead.first_name} {lead.last_name}</h1>
            <p className="text-blue-300 text-xs">{lead.phone} • {lead.email}</p>
          </div>
          {callActive && (
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              phase === 'agent-speaking' ? 'bg-av-blue/30 text-blue-200' :
              phase === 'listening' ? 'bg-red-500/30 text-red-200 animate-pulse-record' :
              phase === 'processing' ? 'bg-av-orange/30 text-orange-200' :
              'bg-white/10 text-white/60'
            }`}>
              {phase === 'agent-speaking' ? '🗣️ Kasia mówi...' :
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
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Past Programs</h2>
              {lead.past_programs.map((p, i) => (
                <div key={i} className="flex items-center gap-2 py-1">
                  <span className="w-2 h-2 bg-av-blue rounded-full"></span>
                  <span className="text-sm text-gray-700">{p}</span>
                </div>
              ))}
            </div>

            <div className="bg-gradient-to-br from-av-blue to-av-blue-dark rounded-xl p-5 text-white">
              <div className="text-xs uppercase tracking-wider opacity-80 mb-1">Recommended</div>
              <div className="text-lg font-bold">Junior {lead.preferred_destination} 2026</div>
              <div className="text-sm opacity-80 mt-1">Early Bird: 4 449 zł</div>
            </div>

            {/* Controls */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Call Settings</h2>
              <select value={voice} onChange={e => setVoice(e.target.value)} disabled={callActive}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-av-blue">
                <option value="Kasia">🎭 Kasia (Female)</option>
                <option value="Marek">🎭 Marek (Male)</option>
              </select>
              <div className="text-xs text-gray-400 px-1">Scenario: Paści — Early Bird Junior</div>
            </div>

            {/* How it works */}
            <div className="bg-av-cream rounded-xl p-5 text-sm text-gray-600">
              <div className="font-semibold text-av-navy mb-2">💡 How it works</div>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Click <b>Start Call</b></li>
                <li>Kasia speaks first (AI voice)</li>
                <li>Your mic turns on automatically</li>
                <li>Speak your response</li>
                <li><b>Auto-stops</b> after ~1.2s silence</li>
                <li>5-7 exchanges total</li>
              </ol>
            </div>
          </div>

          {/* Right: Call + Transcript */}
          <div className="lg:col-span-2 space-y-4">

            {/* Call action */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              {!callActive ? (
                <button onClick={startCall}
                  className="w-full py-4 rounded-xl font-bold text-white text-lg bg-gradient-to-r from-av-blue to-av-blue-dark hover:shadow-lg hover:shadow-av-blue/30 transform hover:scale-[1.02]">
                  🎙️ Start Call
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
                    📞 End Call
                  </button>
                </div>
              )}
              {outcome && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
                  <span className="text-2xl">✅</span>
                  <div>
                    <div className="font-bold text-green-800">{outcome}</div>
                    <div className="text-xs text-green-600">{transcript.length} messages</div>
                  </div>
                </div>
              )}
              {error && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">⚠️ {error}</div>
              )}
            </div>

            {/* Transcript */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Transcript</h2>
              </div>
              <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto min-h-[200px]">
                {transcript.length === 0 && (
                  <div className="text-gray-300 text-center py-16 text-sm">
                    Click "Start Call" to begin conversation
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
                        {m.speaker === 'agent' ? '🤖 Kasia' : '👤 You'}
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
