// Supabase Edge Function: send-reminders
//
// Run on a schedule (see supabase/reminders-cron.sql) — once a day is
// recommended. For every user with an overdue or due-soon task, sends an
// email (via Resend) and/or a browser push notification (via Web Push),
// depending on that user's reminder_prefs.
//
// "Due soon" lead time: each task can set its own reminder_lead_days
// (via the bell on the track page) that overrides the account default
// (reminder_prefs.lead_time_days, set in Settings). A reminder always
// needs a due_date — there's no way to flag a dateless task.
//
// Required secrets (set via `supabase secrets set` or the dashboard):
//   RESEND_API_KEY        — Resend API key
//   REMINDER_FROM_EMAIL   — verified "from" address, e.g. reminders@yourdomain.com
//                            (or onboarding@resend.dev for testing — only
//                            delivers to your own Resend account email)
//   VAPID_PUBLIC_KEY       — same public key as src/lib/push.ts
//   VAPID_PRIVATE_KEY      — pair of the above, keep secret
//   VAPID_SUBJECT          — mailto:you@example.com (contact for push provider)
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically by
// the Edge Functions runtime — no need to set them yourself.

import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@4";
import webpush from "npm:web-push@3";

const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);

const resendApiKey = Deno.env.get("RESEND_API_KEY");
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const fromEmail = Deno.env.get("REMINDER_FROM_EMAIL") ?? "onboarding@resend.dev";

const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:example@example.com";
if (vapidPublic && vapidPrivate) {
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
}

// The largest lead time the UI offers (see REMINDER_LEAD_OPTIONS). Nothing
// due further out than this can be a reminder for anyone, so it bounds the
// window the job has to look at instead of reading the whole tasks table.
const MAX_LEAD_DAYS = 7;

// PostgREST caps a response at 1000 rows, so a single select silently
// truncates. Every read below pages until it is short.
const PAGE_SIZE = 1000;

// How many users to notify at a time. Serial sends meant one slow provider
// response per user, which a scheduled function will time out on long
// before it reaches everybody.
const USER_CONCURRENCY = 8;

// One email body shouldn't try to list thousands of tasks.
const MAX_LISTED_TASKS = 25;

interface RawTask {
  id: string;
  title: string;
  due_date: string;
  reminder_lead_days: number | null;
  user_id: string;
  topic: { title: string; track: { name: string; status: string } };
}

interface ReminderPrefs {
  user_id: string;
  email_reminders_enabled: boolean;
  push_reminders_enabled: boolean;
  lead_time_days: number;
}

const DEFAULT_PREFS: Omit<ReminderPrefs, "user_id"> = {
  email_reminders_enabled: true,
  push_reminders_enabled: true,
  lead_time_days: 1,
};

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function daysUntil(dueDate: string, today: string): number {
  return Math.round((Date.parse(dueDate) - Date.parse(today)) / 86_400_000);
}

function classify(
  task: RawTask,
  accountLeadDays: number,
  today: string,
): "overdue" | "due-soon" | null {
  const leadDays = task.reminder_lead_days ?? accountLeadDays;
  const delta = daysUntil(task.due_date, today);
  if (delta < 0) return "overdue";
  if (delta <= leadDays) return "due-soon";
  return null;
}

const TAG_LABEL: Record<"overdue" | "due-soon", string> = {
  overdue: "Overdue",
  "due-soon": "Due soon",
};

// Reads every page of a PostgREST range query.
async function fetchAllPages<T>(
  run: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await run(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    all.push(...page);
    if (page.length < PAGE_SIZE) return all;
  }
}

async function inBatches<T>(items: T[], size: number, run: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(run));
  }
}

Deno.serve(async (req) => {
  // Supabase's verify_jwt accepts any valid token for the project — the
  // anon key included — so without this check anyone holding the public
  // key could trigger a notification blast. This job is only ever invoked
  // by the scheduler, which sends the service role key.
  const auth = req.headers.get("Authorization") ?? "";
  if (auth !== `Bearer ${serviceRoleKey}`) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const today = isoDay(0);
  const horizon = isoDay(MAX_LEAD_DAYS);

  let allTasks: RawTask[];
  try {
    // Only unfinished tasks already due or due within the longest lead
    // time anyone can configure. This is the whole difference between a
    // job that reads a bounded slice and one that reads every task ever
    // written — and it is served by the partial index on (due_date).
    allTasks = await fetchAllPages<RawTask>((from, to) =>
      supabase
        .from("tasks")
        .select("id, title, due_date, reminder_lead_days, user_id, topic:topics!inner(title, track:tracks!inner(name, status))")
        .eq("done", false)
        .not("due_date", "is", null)
        .lte("due_date", horizon)
        .eq("topic.track.status", "active")
        .order("due_date", { ascending: true })
        .range(from, to)
        .then((r) => ({ data: r.data as unknown as RawTask[] | null, error: r.error })),
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (allTasks.length === 0) {
    return new Response(JSON.stringify({ users: 0, emailsSent: 0, pushesSent: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const candidateUserIds = [...new Set(allTasks.map((t) => t.user_id))];

  const prefsByUser = new Map<string, ReminderPrefs>();
  // `in` filters get unwieldy past a few hundred values, so ask in chunks.
  for (let i = 0; i < candidateUserIds.length; i += 200) {
    const { data } = await supabase
      .from("reminder_prefs")
      .select("*")
      .in("user_id", candidateUserIds.slice(i, i + 200));
    for (const row of (data ?? []) as ReminderPrefs[]) prefsByUser.set(row.user_id, row);
  }

  const dueByUser = new Map<string, { task: RawTask; tag: "overdue" | "due-soon" }[]>();

  for (const task of allTasks) {
    const leadTimeDays = prefsByUser.get(task.user_id)?.lead_time_days ?? DEFAULT_PREFS.lead_time_days;
    const tag = classify(task, leadTimeDays, today);
    if (!tag) continue;
    const existing = dueByUser.get(task.user_id);
    if (existing) existing.push({ task, tag });
    else dueByUser.set(task.user_id, [{ task, tag }]);
  }

  if (dueByUser.size === 0) {
    return new Response(JSON.stringify({ users: 0, emailsSent: 0, pushesSent: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  let emailsSent = 0;
  let pushesSent = 0;
  let failures = 0;

  await inBatches([...dueByUser.entries()], USER_CONCURRENCY, async ([userId, entries]) => {
    const prefs = prefsByUser.get(userId) ?? { user_id: userId, ...DEFAULT_PREFS };
    const summary = `${entries.length} task${entries.length === 1 ? "" : "s"} need${
      entries.length === 1 ? "s" : ""
    } your attention`;

    if (prefs.email_reminders_enabled && resend) {
      try {
        const { data: userRow } = await supabase.auth.admin.getUserById(userId);
        const email = userRow?.user?.email;
        if (email) {
          const shown = entries.slice(0, MAX_LISTED_TASKS);
          const lines = shown
            .map(
              ({ task, tag }) =>
                `- [${TAG_LABEL[tag]}] ${task.topic.track.name} / ${task.topic.title}: ${task.title}`,
            )
            .join("\n");
          const overflow = entries.length - shown.length;
          await resend.emails.send({
            from: fromEmail,
            to: email,
            subject: `Waypoint: ${summary}`,
            text:
              `Tasks needing attention:\n\n${lines}` +
              (overflow > 0 ? `\n\n…and ${overflow} more.` : ""),
          });
          emailsSent++;
        }
      } catch {
        // One user's provider error shouldn't stop everyone else's
        // reminders; the run reports the count instead.
        failures++;
      }
    }

    if (prefs.push_reminders_enabled && vapidPublic && vapidPrivate) {
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("user_id", userId);

      for (const sub of subs ?? []) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({ title: "Waypoint", body: summary, url: "/" }),
          );
          pushesSent++;
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          // 404/410 mean the browser dropped the subscription — prune it
          // so it isn't retried every day forever.
          if (status === 404 || status === 410) {
            await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          } else {
            failures++;
          }
        }
      }
    }
  });

  return new Response(JSON.stringify({ users: dueByUser.size, emailsSent, pushesSent, failures }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
