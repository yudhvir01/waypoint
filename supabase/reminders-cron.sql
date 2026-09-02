-- Schedules the send-reminders Edge Function to run once a day.
-- Run this in the SQL Editor AFTER deploying the function (see
-- docs/writebook/04-reminders.md for the full setup).
--
-- Prefer the dashboard instead? Project → Integrations → Cron Jobs lets you
-- schedule an Edge Function invocation without writing SQL — this file is
-- the equivalent for anyone who'd rather do it here, or automate it.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Replace both placeholders before running:
--   <project-ref>    — your Supabase project ref (e.g. qmhmosjgokreigmsaklx)
--   <service-role-key> — Project Settings → API Keys → service_role (secret)
--                         Never put this key anywhere client-side; this SQL
--                         function body is only ever readable by you as the
--                         project owner.
select cron.schedule(
  'waypoint-send-reminders',
  '0 8 * * *', -- 08:00 UTC daily — adjust to taste
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <service-role-key>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- To change the schedule later:
--   select cron.alter_job(job_id, schedule := '0 8 * * *') from cron.job where jobname = 'waypoint-send-reminders';
-- To remove it:
--   select cron.unschedule('waypoint-send-reminders');
