-- Focus — Learning Tracker
-- One-time setup script. Run this in your Supabase project's SQL Editor
-- (Project → SQL Editor → New query → paste this whole file → Run).
--
-- This creates all the tables, security policies, and helper functions
-- the app needs. Your data stays entirely inside this Supabase project —
-- the app never sends it anywhere else.

-- ---------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  color text,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.tracks (id) on delete cascade,
  title text not null,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'done')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics (id) on delete cascade,
  title text not null,
  done boolean not null default false,
  priority text not null default 'none' check (priority in ('none', 'low', 'medium', 'high')),
  due_date date,
  completed_at timestamptz,
  sort_order integer not null default 0,
  -- Flags this task for reminders regardless of due date / priority.
  remind_me boolean not null default false,
  created_at timestamptz not null default now()
);

-- Safe to re-run against an existing database created before this column
-- existed.
alter table public.tasks add column if not exists remind_me boolean not null default false;

-- Web Push subscriptions, one row per device the user has enabled push on.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- Per-user reminder preferences.
create table if not exists public.reminder_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email_reminders_enabled boolean not null default true,
  push_reminders_enabled boolean not null default true,
  -- How many days before a task's due date it counts as "due soon" for
  -- reminders (0 = only the due date itself, not before).
  lead_time_days integer not null default 1 check (lead_time_days >= 0)
);

alter table public.reminder_prefs
  add column if not exists lead_time_days integer not null default 1;

create index if not exists topics_track_id_idx on public.topics (track_id);
create index if not exists tasks_topic_id_idx on public.tasks (topic_id);
create index if not exists tasks_due_date_idx on public.tasks (due_date) where done = false;

-- ---------------------------------------------------------------------
-- Row Level Security — every user can only ever see their own rows.
-- ---------------------------------------------------------------------

alter table public.tracks enable row level security;
alter table public.topics enable row level security;
alter table public.tasks enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reminder_prefs enable row level security;

drop policy if exists "tracks_owner_all" on public.tracks;
create policy "tracks_owner_all" on public.tracks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "topics_owner_all" on public.topics;
create policy "topics_owner_all" on public.topics
  for all using (
    exists (select 1 from public.tracks t where t.id = track_id and t.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.tracks t where t.id = track_id and t.user_id = auth.uid())
  );

drop policy if exists "tasks_owner_all" on public.tasks;
create policy "tasks_owner_all" on public.tasks
  for all using (
    exists (
      select 1 from public.topics tp
      join public.tracks t on t.id = tp.track_id
      where tp.id = topic_id and t.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.topics tp
      join public.tracks t on t.id = tp.track_id
      where tp.id = topic_id and t.user_id = auth.uid()
    )
  );

drop policy if exists "push_subscriptions_owner_all" on public.push_subscriptions;
create policy "push_subscriptions_owner_all" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "reminder_prefs_owner_all" on public.reminder_prefs;
create policy "reminder_prefs_owner_all" on public.reminder_prefs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Done. Next: copy this project's URL and anon key (Project Settings →
-- API) into the app's "Connect your Supabase project" screen.
--
-- Reminders (email + push) are set up separately in Phase 4 — this
-- script only creates the tables they'll use.
-- ---------------------------------------------------------------------
