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
// needs a due_date — there's no way to flag a dateless task anymore.
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

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const resendApiKey = Deno.env.get("RESEND_API_KEY");
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const fromEmail = Deno.env.get("REMINDER_FROM_EMAIL") ?? "onboarding@resend.dev";

const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:example@example.com";
if (vapidPublic && vapidPrivate) {
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
}

interface RawTask {
  id: string;
  title: string;
  due_date: string | null;
  priority: string;
  reminder_lead_days: number | null;
  topic: { title: string; track: { name: string; user_id: string } };
}

interface ReminderPrefs {
  user_id: string;
  email_reminders_enabled: boolean;
  push_reminders_enabled: boolean;
  lead_time_days: number;
}

function classify(task: RawTask, accountLeadDays: number): "overdue" | "due-soon" | null {
  if (!task.due_date) return null;
  const leadDays = task.reminder_lead_days ?? accountLeadDays;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.due_date);
  due.setHours(0, 0, 0, 0);
  const delta = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (delta < 0) return "overdue";
  if (delta <= leadDays) return "due-soon";
  return null;
}

const TAG_LABEL: Record<"overdue" | "due-soon", string> = {
  overdue: "Overdue",
  "due-soon": "Due soon",
};

Deno.serve(async () => {
  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select(
      "id, title, due_date, priority, reminder_lead_days, topic:topics(title, track:tracks(name, user_id))",
    )
    .eq("done", false);

  if (tasksError) {
    return new Response(JSON.stringify({ error: tasksError.message }), { status: 500 });
  }

  const allTasks = (tasks ?? []) as unknown as RawTask[];
  const candidateUserIds = [...new Set(allTasks.map((t) => t.topic.track.user_id))];

  const { data: prefsRows } = await supabase
    .from("reminder_prefs")
    .select("*")
    .in("user_id", candidateUserIds);
  const prefsByUser = new Map<string, ReminderPrefs>(
    (prefsRows ?? []).map((p) => [p.user_id, p as ReminderPrefs]),
  );

  const dueByUser = new Map<string, { task: RawTask; tag: "overdue" | "due-soon" }[]>();

  for (const task of allTasks) {
    const userId = task.topic.track.user_id;
    const leadTimeDays = prefsByUser.get(userId)?.lead_time_days ?? 1;
    const tag = classify(task, leadTimeDays);
    if (!tag) continue;
    if (!dueByUser.has(userId)) dueByUser.set(userId, []);
    dueByUser.get(userId)!.push({ task, tag });
  }

  if (dueByUser.size === 0) {
    return new Response(JSON.stringify({ notified: 0 }), { status: 200 });
  }

  let emailsSent = 0;
  let pushesSent = 0;

  for (const [userId, entries] of dueByUser) {
    const prefs = prefsByUser.get(userId) ?? {
      email_reminders_enabled: true,
      push_reminders_enabled: true,
      lead_time_days: 1,
    };

    const lines = entries
      .map(
        ({ task, tag }) =>
          `- [${TAG_LABEL[tag]}] ${task.topic.track.name} / ${task.topic.title}: ${task.title}`,
      )
      .join("\n");

    if (prefs.email_reminders_enabled && resend) {
      const { data: userRow } = await supabase.auth.admin.getUserById(userId);
      const email = userRow?.user?.email;
      if (email) {
        await resend.emails.send({
          from: fromEmail,
          to: email,
          subject: `Waypoint: ${entries.length} task${entries.length === 1 ? "" : "s"} need${
            entries.length === 1 ? "s" : ""
          } attention`,
          text: `Tasks needing attention:\n\n${lines}`,
        });
        emailsSent++;
      }
    }

    if (prefs.push_reminders_enabled && vapidPublic && vapidPrivate) {
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", userId);

      for (const sub of subs ?? []) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify({
              title: "Waypoint",
              body: `${entries.length} task${entries.length === 1 ? "" : "s"} need${
                entries.length === 1 ? "s" : ""
              } your attention`,
              url: "/",
            }),
          );
          pushesSent++;
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          }
        }
      }
    }
  }

  return new Response(JSON.stringify({ users: dueByUser.size, emailsSent, pushesSent }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
