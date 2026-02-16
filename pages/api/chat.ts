import type { NextApiRequest, NextApiResponse } from 'next';

// Simple clean chat endpoint for browser use (no tool cards).
// Requires an Anthropic API key set in Vercel env.

const MODEL = process.env.CALLX_CHAT_MODEL || 'claude-opus-4-6';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.TASKFORNOA_ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) {
    return res.status(500).json({
      error: 'Brak ANTHROPIC_API_KEY w środowisku Vercel. Dodaj klucz w Settings → Environment Variables.',
    });
  }

  const { messages } = req.body as { messages?: Array<{ role: 'user' | 'assistant'; content: string }> };
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages[] required' });
  }

  try {
    const system =
      'Jesteś Noa — asystent Michała. Odpowiadasz po polsku. ' +
      'Pisz krótko i konkretnie. Jeśli proszą o zadania w CallX, dawaj jasne kroki.';

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        system,
        max_tokens: 800,
        messages,
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      return res.status(500).json({ error: 'Anthropic API error', details: t });
    }

    const data = await r.json();
    const text = (data?.content || [])
      .filter((c: any) => c?.type === 'text')
      .map((c: any) => c.text)
      .join('\n')
      .trim();

    return res.status(200).json({ ok: true, text });
  } catch (e: any) {
    return res.status(500).json({ error: 'Chat failed', details: e?.message || String(e) });
  }
}
