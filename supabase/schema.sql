-- CallX OS — Supabase schema (Phase 2)
-- Paste into Supabase SQL Editor and run.

-- Required for gen_random_uuid()
create extension if not exists pgcrypto;

-- Training transcripts (we store ONLY text; audio is deleted after transcription)
create table if not exists public.training_transcripts (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'upload', -- upload | agent_call
  lead_customer_id text null,
  file_name text null,
  transcript_text text not null,
  language text not null default 'pl',
  duration_sec int null,
  created_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb
);

create index if not exists training_transcripts_created_at_idx on public.training_transcripts(created_at desc);

-- Optional: chunks for retrieval (RAG) — created now, can be filled later
create table if not exists public.training_chunks (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null references public.training_transcripts(id) on delete cascade,
  chunk_index int not null,
  chunk_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists training_chunks_transcript_id_idx on public.training_chunks(transcript_id);

-- Optional: embeddings (vector extension can be added later)
-- We'll add pgvector + embeddings table when you're ready.
