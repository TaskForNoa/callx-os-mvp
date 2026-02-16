import type { NextApiRequest, NextApiResponse } from 'next';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};

function safeFileName(name: string) {
  return (name || 'audio').replace(/[^a-zA-Z0-9._-]/g, '_');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY;
  if (!DEEPGRAM_KEY) return res.status(500).json({ error: 'DEEPGRAM_API_KEY not configured' });

  try {
    const { audio, fileName, leadCustomerId } = req.body as { audio?: string; fileName?: string; leadCustomerId?: string };
    if (!audio) return res.status(400).json({ error: 'audio (base64) required' });

    const supabase = getSupabaseAdmin();

    const buf = Buffer.from(audio, 'base64');
    const path = `tmp/${Date.now()}_${safeFileName(fileName || 'upload.webm')}`;

    // 1) Upload audio temporarily (private bucket)
    const up = await supabase.storage.from('callx-audio').upload(path, buf, {
      contentType: 'audio/webm',
      upsert: true,
    });

    // Even if upload fails, we can still attempt transcription directly from buffer.
    if (up.error) {
      console.warn('Supabase upload error:', up.error.message);
    }

    // 2) Transcribe via Deepgram (from buffer)
    const dg = await fetch('https://api.deepgram.com/v1/listen?language=pl&model=nova-2&smart_format=true', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_KEY}`,
        'Content-Type': 'audio/webm',
      },
      body: buf,
    });

    let transcript = '';
    let confidence = 0;

    if (dg.ok) {
      const data = await dg.json();
      transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
      confidence = data.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;
    } else {
      const t = await dg.text();
      console.error('Deepgram error:', t);
    }

    // 3) Delete audio immediately (per Michał’s requirement)
    if (!up.error) {
      const del = await supabase.storage.from('callx-audio').remove([path]);
      if (del.error) console.warn('Supabase delete error:', del.error.message);
    }

    // 4) Store transcript text only (if empty, still store an entry for traceability)
    const ins = await supabase
      .from('training_transcripts')
      .insert({
        source: 'upload',
        lead_customer_id: leadCustomerId || null,
        file_name: fileName || null,
        transcript_text: transcript || '',
        language: 'pl',
        meta: {
          deepgram_confidence: confidence,
          had_upload_error: !!up.error,
        },
      })
      .select('id, created_at')
      .single();

    if (ins.error) {
      return res.status(500).json({ error: 'DB insert failed', details: ins.error.message, transcript, confidence });
    }

    return res.status(200).json({
      success: true,
      transcript,
      confidence,
      transcriptId: ins.data.id,
      createdAt: ins.data.created_at,
    });
  } catch (e: any) {
    return res.status(500).json({ error: 'Upload/transcribe failed', details: e?.message || String(e) });
  }
}
