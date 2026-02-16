import type { NextApiRequest, NextApiResponse } from 'next';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const supabase = getSupabaseAdmin();
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);

    const q = await supabase
      .from('training_transcripts')
      .select('id, source, lead_customer_id, file_name, transcript_text, language, created_at, meta')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (q.error) return res.status(500).json({ error: q.error.message });

    return res.status(200).json({ transcripts: q.data || [], total: (q.data || []).length });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
