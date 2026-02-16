import type { NextApiRequest, NextApiResponse } from 'next';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

function guessFromName(name?: string) {
  const n = (name || '').toLowerCase();
  if (n.endsWith('.wav')) return 'audio/wav';
  if (n.endsWith('.mp3')) return 'audio/mpeg';
  if (n.endsWith('.m4a')) return 'audio/mp4';
  if (n.endsWith('.ogg')) return 'audio/ogg';
  if (n.endsWith('.webm')) return 'audio/webm';
  return 'application/octet-stream';
}

function formatErr(e: any) {
  return e?.message || String(e);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY;
  if (!DEEPGRAM_KEY) return res.status(500).json({ error: 'DEEPGRAM_API_KEY not configured' });

  const supabase = getSupabaseAdmin();

  try {
    const { path, fileName, leadCustomerId, contentType } = req.body as {
      path?: string;
      fileName?: string;
      leadCustomerId?: string;
      contentType?: string;
    };

    if (!path) return res.status(400).json({ error: 'path required' });

    const ct = (contentType && typeof contentType === 'string' && contentType.trim())
      ? contentType.trim()
      : guessFromName(fileName);

    // Download file from private bucket
    const dl = await supabase.storage.from('callx-audio').download(path);
    if (dl.error) {
      return res.status(500).json({ error: 'download failed', details: dl.error.message });
    }

    const arr = await dl.data.arrayBuffer();
    const buf = Buffer.from(arr);

    // Transcribe
    const dg = await fetch('https://api.deepgram.com/v1/listen?language=pl&model=nova-2&smart_format=true', {
      method: 'POST',
      headers: {
        Authorization: `Token ${DEEPGRAM_KEY}`,
        'Content-Type': ct,
      },
      body: buf,
    });

    let transcript = '';
    let confidence = 0;
    let deepgramError: string | null = null;

    if (dg.ok) {
      const data = await dg.json();
      transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
      confidence = data.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;
    } else {
      deepgramError = await dg.text();
    }

    // Always delete audio (per requirement)
    const del = await supabase.storage.from('callx-audio').remove([path]);
    if (del.error) console.warn('Supabase delete error:', del.error.message);

    // Store transcript (even empty) for traceability
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
          deepgram_error: deepgramError,
          content_type: ct,
        },
      })
      .select('id, created_at')
      .single();

    if (ins.error) {
      return res.status(500).json({ error: 'DB insert failed', details: ins.error.message, deepgramError });
    }

    if (deepgramError) {
      return res.status(500).json({ error: 'Deepgram API error', details: deepgramError, transcriptId: ins.data.id });
    }

    return res.status(200).json({
      success: true,
      transcript,
      confidence,
      transcriptId: ins.data.id,
      createdAt: ins.data.created_at,
    });
  } catch (e: any) {
    // Best-effort delete if path present
    try {
      const path = (req.body || {}).path;
      if (path) await supabase.storage.from('callx-audio').remove([path]);
    } catch {}

    return res.status(500).json({ error: 'transcribe failed', details: formatErr(e) });
  }
}
