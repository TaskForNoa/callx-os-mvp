// OpenAI Embeddings helper for CallX RAG

const OPENAI_EMBED_MODEL = 'text-embedding-3-small'; // 1536 dims, cheap & fast
const OPENAI_EMBED_URL = 'https://api.openai.com/v1/embeddings';

export async function getEmbedding(text: string): Promise<number[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not configured');

  const res = await fetch(OPENAI_EMBED_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_EMBED_MODEL,
      input: text.slice(0, 8000), // safety trim
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI embeddings error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not configured');

  // OpenAI supports batch embeddings (up to ~2048 inputs)
  const trimmed = texts.map(t => t.slice(0, 8000));

  const res = await fetch(OPENAI_EMBED_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_EMBED_MODEL,
      input: trimmed,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI embeddings error (${res.status}): ${err}`);
  }

  const data = await res.json();
  // Sort by index to ensure order
  return data.data
    .sort((a: any, b: any) => a.index - b.index)
    .map((d: any) => d.embedding);
}

/**
 * Chunk a transcript into overlapping segments.
 * Each chunk is ~chunkSize chars with ~overlap chars overlap.
 */
export function chunkText(text: string, chunkSize = 500, overlap = 100): string[] {
  const chunks: string[] = [];
  if (!text || text.length === 0) return chunks;

  let start = 0;
  while (start < text.length) {
    let end = start + chunkSize;

    // Try to break at sentence boundary
    if (end < text.length) {
      const slice = text.slice(start, end + 50);
      const lastPeriod = slice.lastIndexOf('.');
      const lastQuestion = slice.lastIndexOf('?');
      const lastExclaim = slice.lastIndexOf('!');
      const lastNewline = slice.lastIndexOf('\n');
      const best = Math.max(lastPeriod, lastQuestion, lastExclaim, lastNewline);
      if (best > chunkSize * 0.5) {
        end = start + best + 1;
      }
    } else {
      end = text.length;
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 20) { // skip tiny fragments
      chunks.push(chunk);
    }

    start = end - overlap;
    if (start >= text.length) break;
  }

  return chunks;
}
