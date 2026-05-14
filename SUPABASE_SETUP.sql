-- Optional Supabase table for future cloud sync
create table if not exists public.navo_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.navo_states enable row level security;

drop policy if exists "Users can read own Navo state" on public.navo_states;
create policy "Users can read own Navo state" on public.navo_states for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can insert own Navo state" on public.navo_states;
create policy "Users can insert own Navo state" on public.navo_states for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users can update own Navo state" on public.navo_states;
create policy "Users can update own Navo state" on public.navo_states for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
