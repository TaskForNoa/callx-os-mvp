import type { NextApiRequest, NextApiResponse } from 'next';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { chunkText, getEmbeddings } from '../../../lib/embeddings';

// Keep each call short to fit Vercel timeouts.
export const config = {
  api: {
    bodyParser: { sizeLimit: '1mb' },
  },
};

/**
 * POST /api/training/embedNext
 * Body: { transcriptId: string, batchSize?: number }
 *
 * Idempotent, incremental:
 * - ensures chunk rows exist (embedding null)
 * - embeds next N chunks with embedding is null
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });

  try {
    const { transcriptId, batchSize } = req.body || {};
    if (!transcriptId || typeof transcriptId !== 'string') {
      return res.status(400).json({ error: 'transcriptId required' });
    }

    const bs = Math.max(1, Math.min(Number(batchSize || 5), 20));

    const supabase = getSupabaseAdmin();

    // 1) Fetch transcript
    const { data: t, error: tErr } = await supabase
      .from('training_transcripts')
      .select('id, transcript_text, file_name')
      .eq('id', transcriptId)
      .single();

    if (tErr) return res.status(500).json({ error: 'Transcript fetch failed', details: tErr.message });
    if (!t || !t.transcript_text) return res.status(404).json({ error: 'Transcript not found / empty' });

    // 2) Ensure chunks exist (if none at all)
    const { count: chunkCount } = await supabase
      .from('training_chunks')
      .select('id', { head: true, count: 'exact' })
      .eq('transcript_id', transcriptId);

    if (!chunkCount || chunkCount === 0) {
      const chunks = chunkText(t.transcript_text, 500, 100);
      if (chunks.length === 0) return res.status(200).json({ ok: true, done: true, message: 'No chunks to embed' });

      const rows = chunks.map((chunk, i) => ({
        transcript_id: transcriptId,
        chunk_index: i,
        chunk_text: chunk,
        embedding: null,
      }));

      const { error: insErr } = await supabase.from('training_chunks').insert(rows);
      if (insErr) return res.status(500).json({ error: 'Chunk insert failed', details: insErr.message });
    }

    // 3) Get next batch where embedding is null
    const { data: pending, error: pErr } = await supabase
      .from('training_chunks')
      .select('id, chunk_index, chunk_text')
      .eq('transcript_id', transcriptId)
      .is('embedding', null)
      .order('chunk_index', { ascending: true })
      .limit(bs);

    if (pErr) return res.status(500).json({ error: 'Pending fetch failed', details: pErr.message });

    if (!pending || pending.length === 0) {
      return res.status(200).json({ ok: true, done: true, embedded: 0 });
    }

    // 4) Embed batch
    const texts = pending.map(r => r.chunk_text);
    const embeddings = await getEmbeddings(texts);

    // 5) Update rows (small loop)
    for (let i = 0; i < pending.length; i++) {
      const rowId = pending[i].id;
      const emb = embeddings[i];
      const { error: uErr } = await supabase
        .from('training_chunks')
        .update({ embedding: JSON.stringify(emb) })
        .eq('id', rowId);

      if (uErr) {
        return res.status(500).json({ error: 'Update failed', details: uErr.message, rowId });
      }
    }

    // 6) Progress counts
    const { count: remaining } = await supabase
      .from('training_chunks')
      .select('id', { head: true, count: 'exact' })
      .eq('transcript_id', transcriptId)
      .is('embedding', null);

    return res.status(200).json({
      ok: true,
      done: !remaining || remaining === 0,
      embedded: pending.length,
      remaining: remaining || 0,
      transcriptId,
      fileName: t.file_name || null,
      lastChunkIndex: pending[pending.length - 1].chunk_index,
    });
  } catch (e: any) {
    return res.status(500).json({ error: 'EmbedNext failed', details: e?.message || String(e) });
  }
}
