import type { NextApiRequest, NextApiResponse } from 'next';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { fileName, contentType } = req.body as { fileName?: string; contentType?: string };
    if (!fileName) return res.status(400).json({ error: 'fileName required' });

    const supabase = getSupabaseAdmin();

    const safeName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `tmp/${Date.now()}_${safeName}`;

    // Create a signed upload URL so the browser can upload directly to private storage.
    const r = await supabase.storage.from('callx-audio').createSignedUploadUrl(path);
    if (r.error) {
      return res.status(500).json({ error: 'createSignedUploadUrl failed', details: r.error.message });
    }

    return res.status(200).json({
      path,
      signedUrl: r.data.signedUrl,
      token: r.data.token,
      contentType: contentType || null,
    });
  } catch (e: any) {
    return res.status(500).json({ error: 'signed-upload failed', details: e?.message || String(e) });
  }
}
