import { useEffect, useMemo, useRef, useState } from 'react';

type Msg = { role: 'user' | 'assistant'; content: string };

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>(() => {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem('callx-clean-chat');
    return raw ? (JSON.parse(raw) as Msg[]) : [{ role: 'assistant', content: 'Noa: Jestem. Co robimy dalej?' }];
  });
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('callx-clean-chat', JSON.stringify(messages));
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const canSend = useMemo(() => input.trim().length > 0 && !busy, [input, busy]);

  async function send() {
    if (!canSend) return;
    const userText = input.trim();
    setInput('');
    setError(null);
    const next: Msg[] = [...messages, { role: 'user', content: userText }];
    setMessages(next);
    setBusy(true);

    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || 'Błąd');
      setMessages(prev => [...prev, { role: 'assistant', content: data.text || '(pusta odpowiedź)' }]);
    } catch (e: any) {
      setError(e?.message || 'Błąd');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-av-blue-bg">
      <header className="bg-av-navy text-white">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-lg font-bold">💬 Czysty czat (bez tooli)</h1>
          <p className="text-xs text-blue-200 mt-1">Ten widok pokazuje tylko rozmowę — bez kart narzędzi.</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === 'assistant'
                    ? 'bg-av-blue/10 text-av-navy rounded-bl-md'
                    : 'bg-av-orange/10 text-gray-900 rounded-br-md'
                }`}>
                  <div className="text-[10px] font-semibold uppercase tracking-wider opacity-50 mb-0.5">
                    {m.role === 'assistant' ? 'Noa' : 'Ty'}
                  </div>
                  {m.content}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <div className="border-t border-gray-100 p-3">
            {error && (
              <div className="mb-2 text-sm text-red-600">⚠️ {error}</div>
            )}
            <div className="flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') send(); }}
                placeholder="Napisz wiadomość…"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-av-blue"
                disabled={busy}
              />
              <button
                onClick={send}
                disabled={!canSend}
                className={`px-4 py-2 rounded-lg text-sm font-semibold text-white ${canSend ? 'bg-av-blue hover:bg-av-blue-dark' : 'bg-gray-300'}`}
              >
                {busy ? '…' : 'Wyślij'}
              </button>
              <button
                onClick={() => { localStorage.removeItem('callx-clean-chat'); setMessages([{ role: 'assistant', content: 'Noa: Jestem. Co robimy dalej?' }]); }}
                className="px-3 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                Reset
              </button>
            </div>
            <div className="mt-2 text-[11px] text-gray-400">
              Jeśli widzisz błąd o kluczu API: dodaj <code>ANTHROPIC_API_KEY</code> w Vercel.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
