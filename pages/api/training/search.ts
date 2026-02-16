import type { NextApiRequest, NextApiResponse } from 'next';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { getEmbedding } from '../../../lib/embeddings';

/**
 * POST /api/training/search
 * Body: { query: string, threshold?: number, limit?: number }
 *
 * Returns similar training chunks (RAG retrieval).
 * Used by conversation engine to inject relevant context.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });

  try {
    const { query, threshold = 0.7, limit = 5 } = req.body || {};
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'query (string) required' });
    }

    // Generate embedding for the query
    const queryEmbedding = await getEmbedding(query);

    // Call Supabase RPC (match_training_chunks function)
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc('match_training_chunks', {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: threshold,
      match_count: limit,
    });

    if (error) {
      return res.status(500).json({ error: 'Search failed', details: error.message });
    }

    return res.status(200).json({
      results: data || [],
      count: (data || []).length,
    });
  } catch (e: any) {
    return res.status(500).json({ error: 'Search failed', details: e?.message || String(e) });
  }
}
