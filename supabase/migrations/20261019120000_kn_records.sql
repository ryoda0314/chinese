-- ことのね: a learner's record (the State of src/lib/rain-core.ts), one row per account. The accounts are ことのあめ's
-- (the same Supabase project); everything of ことのね's is prefixed kn_, and nothing of ことのあめ (pl_) or the old
-- app is touched. Read and written from the browser as the learner (RLS: only their own row).
create table if not exists public.kn_records (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now(),
  -- A record is a few tens of kB; this keeps the table from being used as storage.
  constraint kn_records_size check (pg_column_size(state) < 262144)
);

alter table public.kn_records enable row level security;

drop policy if exists "kn_records own" on public.kn_records;
create policy "kn_records own" on public.kn_records
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
