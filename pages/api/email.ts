import type { NextApiRequest, NextApiResponse } from 'next';

// Email simulation endpoint (MVP): stores outgoing emails in-memory.
// NOTE: This will be lost on serverless cold start (acceptable for now).

// Use global storage so it can be shared across API routes in the same runtime.
const getStore = (): any[] => {
  (globalThis as any).__callx_emails = (globalThis as any).__callx_emails || [];
  return (globalThis as any).__callx_emails;
};

function nowIso() {
  return new Date().toISOString();
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { to, cc, subject, body, meta } = req.body || {};

    if (!to || typeof to !== 'string') {
      return res.status(400).json({ error: 'to (string) required' });
    }

    const email = {
      email_id: `email_${Date.now()}`,
      provider: 'simulated',
      from: 'taskfornoa@gmail.com',
      to,
      cc: Array.isArray(cc) ? cc : (cc ? [cc] : []),
      subject: subject || '(brak tematu)',
      body: body || '',
      meta: meta || null,
      status: 'sent',
      sent_at: nowIso(),
    };

    const emails = getStore();
    emails.push(email);

    return res.status(200).json({ success: true, email });
  }

  if (req.method === 'GET') {
    const emails = getStore();
    return res.status(200).json({
      emails: emails.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()),
      total: emails.length,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
