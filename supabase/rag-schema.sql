-- CallX OS — RAG embeddings schema
-- Run AFTER enabling pgvector extension in Supabase Dashboard
-- (Database → Extensions → vector → Enable)

-- Enable pgvector
create extension if not exists vector;

-- Add embedding column to training_chunks
alter table public.training_chunks
  add column if not exists embedding vector(1536);

-- Index for fast similarity search (ivfflat — good for <1M rows)
create index if not exists training_chunks_embedding_idx
  on public.training_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 50);

-- Function: similarity search
create or replace function match_training_chunks(
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 5
)
returns table (
  id uuid,
  transcript_id uuid,
  chunk_index int,
  chunk_text text,
  similarity float
)
language sql stable
as $$
  select
    tc.id,
    tc.transcript_id,
    tc.chunk_index,
    tc.chunk_text,
    1 - (tc.embedding <=> query_embedding) as similarity
  from public.training_chunks tc
  where tc.embedding is not null
    and 1 - (tc.embedding <=> query_embedding) > match_threshold
  order by tc.embedding <=> query_embedding
  limit match_count;
$$;
