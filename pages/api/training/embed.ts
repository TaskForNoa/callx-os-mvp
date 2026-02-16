import type { NextApiRequest, NextApiResponse } from 'next';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { chunkText, getEmbeddings } from '../../../lib/embeddings';

/**
 * POST /api/training/embed
 * Body: { transcriptId?: string }
 *
 * If transcriptId is given, process that one transcript.
 * If omitted, process ALL transcripts that have no chunks yet.
 *
 * Flow:
 * 1. Read transcript(s) from training_transcripts
 * 2. Chunk text into ~500-char segments
 * 3. Generate embeddings via OpenAI
 * 4. Insert into training_chunks with embedding vector
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });

  try {
    const supabase = getSupabaseAdmin();
    const { transcriptId } = req.body || {};

    // Fetch transcripts to process
    let query = supabase
      .from('training_transcripts')
      .select('id, transcript_text')
      .neq('transcript_text', '');

    if (transcriptId) {
      query = query.eq('id', transcriptId);
    }

    const { data: transcripts, error: fetchErr } = await query;
    if (fetchErr) return res.status(500).json({ error: 'DB fetch failed', details: fetchErr.message });
    if (!transcripts || transcripts.length === 0) return res.status(200).json({ processed: 0, message: 'No transcripts to process' });

    let totalChunks = 0;
    let totalEmbedded = 0;
    const errors: string[] = [];

    for (const t of transcripts) {
      // Check if already has chunks with embeddings
      const { count } = await supabase
        .from('training_chunks')
        .select('id', { count: 'exact', head: true })
        .eq('transcript_id', t.id)
        .not('embedding', 'is', null);

      if (count && count > 0) {
        // Already embedded, skip
        continue;
      }

      // Delete old chunks without embeddings (re-process)
      await supabase
        .from('training_chunks')
        .delete()
        .eq('transcript_id', t.id);

      // Chunk the text
      const chunks = chunkText(t.transcript_text, 500, 100);
      if (chunks.length === 0) continue;

      totalChunks += chunks.length;

      // Generate embeddings in batch
      let embeddings: number[][];
      try {
        embeddings = await getEmbeddings(chunks);
      } catch (e: any) {
        errors.push(`Transcript ${t.id}: ${e.message}`);
        continue;
      }

      // Insert chunks with embeddings
      const rows = chunks.map((chunk, i) => ({
        transcript_id: t.id,
        chunk_index: i,
        chunk_text: chunk,
        embedding: JSON.stringify(embeddings[i]),
      }));

      const { error: insertErr } = await supabase
        .from('training_chunks')
        .insert(rows);

      if (insertErr) {
        errors.push(`Transcript ${t.id}: insert failed — ${insertErr.message}`);
      } else {
        totalEmbedded += chunks.length;
      }
    }

    return res.status(200).json({
      processed: transcripts.length,
      totalChunks,
      totalEmbedded,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e: any) {
    return res.status(500).json({ error: 'Embed failed', details: e?.message || String(e) });
  }
}
