-- DoseCerta schema for Supabase (PostgreSQL)

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  phone text not null unique,
  name text,
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now()
);

create table if not exists public.treatments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  medication_name text not null,
  dosage text,
  frequency_every_hours int,
  times_per_day int,
  anchor_times jsonb not null default '[]'::jsonb,
  first_dose_at timestamptz not null,
  ends_at timestamptz not null,
  remind_before_minutes int not null default 15,
  notes text,
  source_text text not null,
  parsed_json jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.doses (
  id uuid primary key default gen_random_uuid(),
  treatment_id uuid not null references public.treatments(id) on delete cascade,
  scheduled_at timestamptz not null,
  remind_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'reminded', 'taken', 'skipped', 'snoozed')),
  reminded_at timestamptz,
  taken_at timestamptz,
  snooze_count int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists doses_status_remind_at_idx on public.doses (status, remind_at);
create index if not exists doses_treatment_scheduled_idx on public.doses (treatment_id, scheduled_at);

create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  phone text not null unique,
  state text not null default 'idle',
  draft_json jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.message_logs (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  body text not null,
  meta_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists message_logs_phone_created_idx on public.message_logs (phone, created_at desc);

-- Storage bucket for prescription / attachment files (optional MVP+)
-- Run in Supabase SQL editor when Storage is enabled:
-- insert into storage.buckets (id, name, public)
-- values ('treatment-files', 'treatment-files', false)
-- on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.treatments enable row level security;
alter table public.doses enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.message_logs enable row level security;

-- Basic owner policies (auth.users linked via profiles.auth_user_id)
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = auth_user_id);

create policy "treatments_owner_all" on public.treatments
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = treatments.user_id and p.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = treatments.user_id and p.auth_user_id = auth.uid()
    )
  );

create policy "doses_owner_all" on public.doses
  for all using (
    exists (
      select 1
      from public.treatments t
      join public.profiles p on p.id = t.user_id
      where t.id = doses.treatment_id and p.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.treatments t
      join public.profiles p on p.id = t.user_id
      where t.id = doses.treatment_id and p.auth_user_id = auth.uid()
    )
  );
