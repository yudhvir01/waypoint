-- Waypoint — Learning Tracker
-- One-time setup script. Run this in your Supabase project's SQL Editor
-- (Project → SQL Editor → New query → paste this whole file → Run).
--
-- This creates all the tables, indexes, security policies, and helper
-- functions the app needs. Your data stays entirely inside this Supabase
-- project — the app never sends it anywhere else.
--
-- The whole script is idempotent: it is safe to re-run against a database
-- created by an earlier version of it, and it will migrate that database
-- forward in place without losing rows.

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
  -- Per-task override of how many days before due_date to send a reminder.
  -- Null means "use the account default (reminder_prefs.lead_time_days)".
  -- Only meaningful when due_date is set — a reminder needs a date to
  -- count backwards from.
  reminder_lead_days integer check (reminder_lead_days >= 0),
  created_at timestamptz not null default now()
);

-- Safe to re-run against an existing database created before this column
-- existed (and to drop the boolean flag this column replaced).
alter table public.tasks drop column if exists remind_me;
alter table public.tasks add column if not exists reminder_lead_days integer check (reminder_lead_days >= 0);

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

-- ---------------------------------------------------------------------
-- Denormalized ownership
--
-- topics and tasks each carry their owner's user_id. It is redundant with
-- topic -> track -> user_id, and it is what makes the app hold up with a
-- lot of rows:
--
--   * RLS becomes `auth.uid() = user_id` — a single indexed equality —
--     instead of a correlated EXISTS that joins two parent tables for
--     every candidate row. That subquery is what turns a "give me this
--     user's due tasks" query into a scan of everybody's tasks.
--   * Every "across all my tracks" query (Focus Now, per-track progress,
--     the reminder job) can be answered from one index on tasks rather
--     than a three-table join.
--
-- The column is never accepted from the client: the trigger below always
-- derives it from the parent row, so it cannot be spoofed or drift.
-- ---------------------------------------------------------------------

alter table public.topics add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table public.tasks  add column if not exists user_id uuid references auth.users (id) on delete cascade;

-- tasks also carry their track. Focus Now walks the user's *active*
-- tracks and takes the top few open tasks from each, so it never reads
-- rows belonging to a paused or archived track at all. Without this
-- column that filter lives two joins away, and archiving a large track
-- leaves the dashboard skipping over its rows on every query.
alter table public.tasks add column if not exists track_id uuid references public.tracks (id) on delete cascade;

-- Backfill anything created before the column existed. Batched by track so
-- a large existing database doesn't do it as one giant statement.
update public.topics tp
   set user_id = t.user_id
  from public.tracks t
 where t.id = tp.track_id
   and tp.user_id is distinct from t.user_id;

update public.tasks ts
   set user_id = tp.user_id,
       track_id = tp.track_id
  from public.topics tp
 where tp.id = ts.topic_id
   and (ts.user_id is distinct from tp.user_id or ts.track_id is distinct from tp.track_id);

create or replace function public.topics_set_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select t.user_id into new.user_id from public.tracks t where t.id = new.track_id;
  if new.user_id is null then
    raise exception 'track % does not exist', new.track_id;
  end if;
  -- Append to the end of the track when the caller didn't pick a position.
  if new.sort_order is null then
    select coalesce(max(sort_order), -1) + 1 into new.sort_order
      from public.topics where track_id = new.track_id;
  end if;
  return new;
end;
$$;

create or replace function public.tasks_set_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select tp.user_id, tp.track_id into new.user_id, new.track_id
    from public.topics tp where tp.id = new.topic_id;
  if new.user_id is null then
    raise exception 'topic % does not exist', new.topic_id;
  end if;
  if new.sort_order is null then
    select coalesce(max(sort_order), -1) + 1 into new.sort_order
      from public.tasks where topic_id = new.topic_id;
  end if;
  -- completed_at is derived from `done` rather than trusted from the
  -- client, so the two can never disagree.
  if new.done and new.completed_at is null then
    new.completed_at := now();
  elsif not new.done then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists topics_set_owner on public.topics;
create trigger topics_set_owner
  before insert or update of track_id on public.topics
  for each row execute function public.topics_set_owner();

drop trigger if exists tasks_set_owner on public.tasks;
create trigger tasks_set_owner
  before insert or update of topic_id, done on public.tasks
  for each row execute function public.tasks_set_owner();

-- Moving a track to another owner (not something the app does, but the
-- data model shouldn't be able to end up inconsistent) re-stamps its
-- descendants.
create or replace function public.tracks_cascade_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.topics set user_id = new.user_id where track_id = new.id;
  update public.tasks set user_id = new.user_id where track_id = new.id;
  update public.topic_counts set user_id = new.user_id where track_id = new.id;
  return null;
end;
$$;

drop trigger if exists tracks_cascade_owner on public.tracks;
create trigger tracks_cascade_owner
  after update of user_id on public.tracks
  for each row when (old.user_id is distinct from new.user_id)
  execute function public.tracks_cascade_owner();

-- Moving a topic between tracks re-stamps its tasks.
create or replace function public.topics_cascade_track()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tasks set track_id = new.track_id, user_id = new.user_id
   where topic_id = new.id;
  update public.topic_counts set track_id = new.track_id, user_id = new.user_id
   where topic_id = new.id;
  return null;
end;
$$;

drop trigger if exists topics_cascade_track on public.topics;
create trigger topics_cascade_track
  after update of track_id, user_id on public.topics
  for each row when (old.track_id is distinct from new.track_id
                     or old.user_id is distinct from new.user_id)
  execute function public.topics_cascade_track();

alter table public.topics alter column user_id set not null;
alter table public.tasks  alter column user_id set not null;
alter table public.tasks  alter column track_id set not null;

-- sort_order is assigned by the triggers above when the client omits it,
-- so it must be nullable on the way in. It is never null on the way out.
alter table public.topics alter column sort_order drop default;
alter table public.tasks  alter column sort_order drop default;
alter table public.topics alter column sort_order drop not null;
alter table public.tasks  alter column sort_order drop not null;

-- ---------------------------------------------------------------------
-- Indexes
--
-- Each one backs a specific query the app makes. The partial indexes
-- matter most: the reminder job and Focus Now only ever look at
-- unfinished tasks, which stays a small slice even when the table is
-- mostly completed history.
-- ---------------------------------------------------------------------

create index if not exists tracks_user_status_idx on public.tracks (user_id, status, created_at desc);
create index if not exists topics_track_sort_idx on public.topics (track_id, sort_order, created_at);
create index if not exists topics_user_id_idx on public.topics (user_id);
create index if not exists tasks_topic_sort_idx on public.tasks (topic_id, sort_order, created_at);

-- Focus Now / per-track progress: one index answers "this user's open
-- tasks", newest schema keeps `done` in the key so both halves of the
-- done/total count come from the same scan.
create index if not exists tasks_user_done_idx on public.tasks (user_id, done);
create index if not exists tasks_user_open_due_idx on public.tasks (user_id, due_date) where done = false;

-- Focus Now's priority tiers, each ordered by the column it ranks on so
-- the tier's LIMIT can stop the scan early instead of sorting everything.
-- Keyed by track, because the tiers are driven by the user's active
-- tracks: rows under an archived track are never visited.
create index if not exists tasks_track_open_due_idx on public.tasks (track_id, due_date) where done = false;
create index if not exists tasks_track_priority_idx on public.tasks (track_id, priority, created_at) where done = false;
create index if not exists tasks_track_created_idx on public.tasks (track_id, created_at) where done = false;

-- The reminder job's cross-user query: "every open task due on or before
-- <date>", ordered by the date it filters on.
create index if not exists tasks_open_due_idx on public.tasks (due_date) where done = false and due_date is not null;

drop index if exists public.tasks_due_date_idx;
drop index if exists public.topics_track_id_idx;
drop index if exists public.tasks_topic_id_idx;

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

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
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- topics/tasks are checked against their own user_id column, which the
-- triggers above derive from the parent. INSERT arrives with user_id
-- already stamped by the BEFORE trigger, so the WITH CHECK still proves
-- the caller owns the parent track.
drop policy if exists "topics_owner_all" on public.topics;
create policy "topics_owner_all" on public.topics
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "tasks_owner_all" on public.tasks;
create policy "tasks_owner_all" on public.tasks
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "push_subscriptions_owner_all" on public.push_subscriptions;
create policy "push_subscriptions_owner_all" on public.push_subscriptions
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "reminder_prefs_owner_all" on public.reminder_prefs;
create policy "reminder_prefs_owner_all" on public.reminder_prefs
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- Progress counters
--
-- The sidebar and the track header show "done / total" on every page.
-- Computing that with count(*) means reading every task row the user
-- owns each time — around a third of a second once an account holds a
-- million tasks, on a query that runs on every navigation.
--
-- So the counts are maintained instead of derived: one row per topic,
-- updated by statement-level triggers on tasks. The triggers use
-- transition tables, so a bulk insert of twenty thousand tasks costs one
-- grouped UPDATE rather than twenty thousand of them.
-- ---------------------------------------------------------------------

create table if not exists public.topic_counts (
  topic_id    uuid primary key references public.topics (id) on delete cascade,
  track_id    uuid not null references public.tracks (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  done_count  integer not null default 0,
  total_count integer not null default 0
);

create index if not exists topic_counts_user_track_idx on public.topic_counts (user_id, track_id);

alter table public.topic_counts enable row level security;

-- Read-only to clients: the counters are derived data, maintained solely
-- by the triggers below.
drop policy if exists "topic_counts_owner_read" on public.topic_counts;
create policy "topic_counts_owner_read" on public.topic_counts
  for select using ((select auth.uid()) = user_id);

create or replace function public.topic_counts_apply(deltas jsonb)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  insert into public.topic_counts (topic_id, track_id, user_id, done_count, total_count)
  select tp.id, tp.track_id, tp.user_id,
         (d ->> 'done')::integer, (d ->> 'total')::integer
    from jsonb_array_elements(deltas) d
    join public.topics tp on tp.id = (d ->> 'topic_id')::uuid
  on conflict (topic_id) do update
    set done_count  = greatest(0, public.topic_counts.done_count  + excluded.done_count),
        total_count = greatest(0, public.topic_counts.total_count + excluded.total_count);
$$;

create or replace function public.tasks_counts_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.topic_counts_apply((
    select coalesce(jsonb_agg(jsonb_build_object(
             'topic_id', s.topic_id, 'done', s.d, 'total', s.t)), '[]'::jsonb)
      from (
        select topic_id,
               count(*) filter (where done) as d,
               count(*)                     as t
          from new_rows group by topic_id
      ) s
  ));
  return null;
end;
$$;

create or replace function public.tasks_counts_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.topic_counts_apply((
    select coalesce(jsonb_agg(jsonb_build_object(
             'topic_id', s.topic_id, 'done', s.d, 'total', s.t)), '[]'::jsonb)
      from (
        select topic_id,
               -count(*) filter (where done) as d,
               -count(*)                     as t
          from old_rows group by topic_id
      ) s
  ));
  return null;
end;
$$;

-- An update can flip `done` and/or move a task to another topic, so it is
-- applied as a removal from the old topic and an addition to the new one.
create or replace function public.tasks_counts_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.topic_counts_apply((
    select coalesce(jsonb_agg(jsonb_build_object(
             'topic_id', topic_id, 'done', d, 'total', t)), '[]'::jsonb)
      from (
        select topic_id, sum(d) as d, sum(t) as t from (
          select o.topic_id,
                 case when o.done then -1 else 0 end as d,
                 -1 as t
            from old_rows o
          union all
          select n.topic_id,
                 case when n.done then 1 else 0 end as d,
                 1 as t
            from new_rows n
        ) x group by topic_id
      ) y
  ));
  return null;
end;
$$;

drop trigger if exists tasks_counts_insert on public.tasks;
create trigger tasks_counts_insert
  after insert on public.tasks
  referencing new table as new_rows
  for each statement execute function public.tasks_counts_insert();

drop trigger if exists tasks_counts_delete on public.tasks;
create trigger tasks_counts_delete
  after delete on public.tasks
  referencing old table as old_rows
  for each statement execute function public.tasks_counts_delete();

drop trigger if exists tasks_counts_update on public.tasks;
create trigger tasks_counts_update
  after update on public.tasks
  referencing old table as old_rows new table as new_rows
  for each statement execute function public.tasks_counts_update();

-- A topic starts life with a zero row so an empty topic still reports 0/0.
create or replace function public.topics_counts_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.topic_counts (topic_id, track_id, user_id, done_count, total_count)
  values (new.id, new.track_id, new.user_id, 0, 0)
  on conflict (topic_id) do update
    set track_id = excluded.track_id, user_id = excluded.user_id;
  return null;
end;
$$;

drop trigger if exists topics_counts_insert on public.topics;
create trigger topics_counts_insert
  after insert or update of track_id, user_id on public.topics
  for each row execute function public.topics_counts_insert();

-- Backfill: rebuilds every counter from the tasks table. Runs once on a
-- database that predates this table, and is a no-op afterwards — it is
-- also the thing to run by hand if the counters are ever suspected of
-- having drifted.
create or replace function public.rebuild_topic_counts()
returns void
language sql
volatile
security definer
set search_path = public
as $$
  insert into public.topic_counts (topic_id, track_id, user_id, done_count, total_count)
  select tp.id, tp.track_id, tp.user_id,
         coalesce(c.done, 0), coalesce(c.total, 0)
    from public.topics tp
    left join (
      select topic_id,
             count(*) filter (where done) as done,
             count(*)                     as total
        from public.tasks group by topic_id
    ) c on c.topic_id = tp.id
  on conflict (topic_id) do update
    set track_id    = excluded.track_id,
        user_id     = excluded.user_id,
        done_count  = excluded.done_count,
        total_count = excluded.total_count;
$$;

do $$
begin
  if not exists (select 1 from public.topic_counts limit 1) then
    perform public.rebuild_topic_counts();
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Aggregates
--
-- These read the maintained counters, so their cost scales with how many
-- topics a person has, not with how many tasks they have written.
-- ---------------------------------------------------------------------

-- Done/total per track, for the sidebar and the track header.
create or replace function public.track_progress()
returns table (track_id uuid, done bigint, total bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select c.track_id, sum(c.done_count)::bigint, sum(c.total_count)::bigint
    from public.topic_counts c
   where c.user_id = (select auth.uid())
   group by c.track_id
  having sum(c.total_count) > 0;
$$;

-- Done/total per topic within one track, so a track page with hundreds of
-- collapsed topics is one request instead of one request per topic.
create or replace function public.topic_progress(p_track_id uuid)
returns table (topic_id uuid, done bigint, total bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select c.topic_id, c.done_count::bigint, c.total_count::bigint
    from public.topic_counts c
   where c.user_id = (select auth.uid())
     and c.track_id = p_track_id;
$$;

-- ---------------------------------------------------------------------
-- Focus Now
--
-- The ranking is five tiers: overdue, due within two days, then high and
-- medium priority, then everything else. Expressing that as one ORDER BY
-- over a CASE forces Postgres to sort every open task the user has —
-- half a second once an account is large. Each tier is instead its own
-- index-ordered query with its own LIMIT, so the work is proportional to
-- how many rows get returned rather than how many exist.
-- ---------------------------------------------------------------------
create or replace function public.focus_tasks(p_limit integer default 50)
returns table (
  id uuid,
  topic_id uuid,
  title text,
  done boolean,
  priority text,
  due_date date,
  completed_at timestamptz,
  sort_order integer,
  reminder_lead_days integer,
  created_at timestamptz,
  topic_title text,
  track_id uuid,
  track_name text
)
language sql
stable
security invoker
set search_path = public
as $$
with
  args as (select greatest(1, least(coalesce(p_limit, 50), 200)) as lim),
  -- The tiers are driven by the user's active tracks, so paused and
  -- archived ones are never opened. That is what keeps the cost tied to
  -- how much is on screen rather than to how much has been archived.
  live as (
    select t.id from public.tracks t
     where t.user_id = (select auth.uid()) and t.status = 'active'
  ),
  tier0 as ( -- overdue
    select x.* from live a cross join lateral (
      select ts.*, 0 as tier from public.tasks ts
       where ts.track_id = a.id and ts.done = false
         and ts.due_date < current_date
       order by ts.due_date asc limit (select lim from args)
    ) x order by x.due_date asc limit (select lim from args)
  ),
  tier1 as ( -- due within two days
    select x.* from live a cross join lateral (
      select ts.*, 1 as tier from public.tasks ts
       where ts.track_id = a.id and ts.done = false
         and ts.due_date >= current_date and ts.due_date <= current_date + 2
       order by ts.due_date asc limit (select lim from args)
    ) x order by x.due_date asc limit (select lim from args)
  ),
  tier2 as ( -- high priority, nothing imminent
    select x.* from live a cross join lateral (
      select ts.*, 2 as tier from public.tasks ts
       where ts.track_id = a.id and ts.done = false
         and ts.priority = 'high'
         and (ts.due_date is null or ts.due_date > current_date + 2)
       order by ts.created_at asc limit (select lim from args)
    ) x order by x.created_at asc limit (select lim from args)
  ),
  tier3 as ( -- medium priority
    select x.* from live a cross join lateral (
      select ts.*, 3 as tier from public.tasks ts
       where ts.track_id = a.id and ts.done = false
         and ts.priority = 'medium'
         and (ts.due_date is null or ts.due_date > current_date + 2)
       order by ts.created_at asc limit (select lim from args)
    ) x order by x.created_at asc limit (select lim from args)
  ),
  tier4 as ( -- everything else
    select x.* from live a cross join lateral (
      select ts.*, 4 as tier from public.tasks ts
       where ts.track_id = a.id and ts.done = false
         and ts.priority not in ('high', 'medium')
         and (ts.due_date is null or ts.due_date > current_date + 2)
       order by ts.created_at asc limit (select lim from args)
    ) x order by x.created_at asc limit (select lim from args)
  ),
  candidates as (
    select * from tier0 union all select * from tier1 union all
    select * from tier2 union all select * from tier3 union all select * from tier4
  )
select c.id, c.topic_id, c.title, c.done, c.priority, c.due_date,
       c.completed_at, c.sort_order, c.reminder_lead_days, c.created_at,
       tp.title as topic_title, c.track_id, t.name as track_name
  from candidates c
  join public.topics tp on tp.id = c.topic_id
  join public.tracks t  on t.id  = c.track_id
 order by c.tier, c.due_date asc nulls last, c.created_at asc
 limit (select lim from args);
$$;

-- ---------------------------------------------------------------------
-- Markdown import
--
-- One statement, one transaction. The old client-side loop issued a
-- request per topic, so a failure partway through a large import left a
-- half-written track behind and there was no way to tell how far it got.
-- ---------------------------------------------------------------------
create or replace function public.import_track(payload jsonb)
returns uuid
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_uid        uuid := (select auth.uid());
  v_track_id   uuid;
  v_topic      jsonb;
  v_topic_id   uuid;
  v_topic_idx  integer := 0;
  v_task_count integer;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  v_task_count := (
    select count(*)
      from jsonb_array_elements(coalesce(payload -> 'topics', '[]'::jsonb)) tp,
           jsonb_array_elements(coalesce(tp -> 'tasks', '[]'::jsonb))
  );
  if v_task_count > 20000 then
    raise exception 'import too large: % tasks (limit 20000)', v_task_count;
  end if;

  if nullif(trim(coalesce(payload ->> 'trackName', '')), '') is null then
    raise exception 'import needs a track name';
  end if;

  insert into public.tracks (user_id, name, description)
  values (v_uid,
          trim(payload ->> 'trackName'),
          nullif(trim(coalesce(payload ->> 'description', '')), ''))
  returning id into v_track_id;

  for v_topic in select * from jsonb_array_elements(coalesce(payload -> 'topics', '[]'::jsonb))
  loop
    insert into public.topics (track_id, title, sort_order, status)
    values (
      v_track_id,
      v_topic ->> 'title',
      v_topic_idx,
      case
        when jsonb_array_length(coalesce(v_topic -> 'tasks', '[]'::jsonb)) > 0
         and not exists (
               select 1 from jsonb_array_elements(v_topic -> 'tasks') tk
                where coalesce((tk ->> 'done')::boolean, false) = false
             )
        then 'done' else 'not_started'
      end
    )
    returning id into v_topic_id;

    insert into public.tasks (topic_id, title, done, priority, due_date, sort_order)
    select v_topic_id,
           tk ->> 'title',
           coalesce((tk ->> 'done')::boolean, false),
           coalesce(nullif(tk ->> 'priority', ''), 'none'),
           nullif(tk ->> 'dueDate', '')::date,
           (ordinality - 1)::integer
      from jsonb_array_elements(coalesce(v_topic -> 'tasks', '[]'::jsonb)) with ordinality as t(tk, ordinality);

    v_topic_idx := v_topic_idx + 1;
  end loop;

  return v_track_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Done. Next: copy this project's URL and anon key (Project Settings →
-- API) into the app's "Connect your Supabase project" screen.
--
-- Reminders (email + push) are set up separately — see
-- docs/writebook/04-reminders.md.
-- ---------------------------------------------------------------------
