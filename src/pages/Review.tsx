import { Link } from "react-router-dom";
import { useState } from "react";
import { AppShell } from "../components/AppShell";
import { useSnapshot } from "../hooks/useSnapshot";
import { useRescheduleTasks } from "../hooks/useTasks";
import { toDateKey } from "../lib/recurrence";
import { computeInsights, STALE_AFTER_DAYS, type HeatCell, type TaskWithPlace } from "../lib/insights";
import { useMemo } from "react";

const LEVEL_CLASS: Record<HeatCell["level"], string> = {
  0: "bg-border/70",
  1: "bg-primary/25",
  2: "bg-primary/50",
  3: "bg-primary/75",
  4: "bg-primary",
};

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

function TaskList({ items, showDue = false }: { items: TaskWithPlace[]; showDue?: boolean }) {
  return (
    <ul>
      {items.slice(0, 15).map(({ task, topic, track }) => (
        <li key={task.id} className="border-b border-border last:border-0">
          <Link
            to={`/tracks/${task.track_id}?topic=${task.topic_id}`}
            className="-mx-2 flex items-baseline justify-between gap-3 rounded-sm px-2 py-2.5 hover:bg-accent/50"
          >
            <span className="min-w-0">
              <span className="block truncate text-[15px]">{task.title}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {track?.name} &rarr; {topic?.title}
              </span>
            </span>
            {showDue && task.due_date && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {new Date(task.due_date).toLocaleDateString()}
              </span>
            )}
          </Link>
        </li>
      ))}
      {items.length > 15 && (
        <li className="py-2 text-xs text-muted-foreground">and {items.length - 15} more</li>
      )}
    </ul>
  );
}

function Heatmap({ columns }: { columns: HeatCell[][] }) {
  return (
    <div className="overflow-x-auto pb-1">
      <div className="inline-flex gap-[3px]" role="img" aria-label="Tasks completed per day, last 26 weeks">
        {columns.map((column, w) => (
          <div key={w} className="flex flex-col gap-[3px]">
            {column.map((cell) => (
              <div
                key={cell.key}
                title={
                  cell.future
                    ? undefined
                    : `${new Date(cell.key + "T00:00").toLocaleDateString()} — ${cell.count} done`
                }
                className={`h-3 w-3 rounded-[3px] ${cell.future ? "opacity-0" : LEVEL_CLASS[cell.level]}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Overdue tasks are the single biggest reason people abandon a task
// app, so Review lets you clear the pile in one move instead of
// confronting it one task at a time.
function SlippedActions({ taskIds }: { taskIds: string[] }) {
  const reschedule = useRescheduleTasks();
  const [confirm, setConfirm] = useState<"today" | "clear" | null>(null);

  function run(dueDate: string | null) {
    reschedule.mutate({ taskIds, dueDate }, { onSettled: () => setConfirm(null) });
  }

  const btn =
    "rounded-md border border-border px-2.5 py-1 text-xs transition-colors hover:border-primary hover:bg-accent disabled:opacity-60";

  if (confirm) {
    const text =
      confirm === "today"
        ? `Move ${taskIds.length} task${taskIds.length === 1 ? "" : "s"} to today?`
        : `Remove the deadline from ${taskIds.length} task${taskIds.length === 1 ? "" : "s"}? They stay on your list.`;
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span>{text}</span>
        <button
          type="button"
          disabled={reschedule.isPending}
          onClick={() => run(confirm === "today" ? toDateKey(new Date()) : null)}
          className="rounded-md bg-primary px-2.5 py-1 font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          Yes
        </button>
        <button type="button" onClick={() => setConfirm(null)} className="text-muted-foreground hover:underline">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <button type="button" onClick={() => setConfirm("today")} className={btn}>
        Move all to today
      </button>
      <button type="button" onClick={() => setConfirm("clear")} className={btn}>
        Clear deadlines
      </button>
    </div>
  );
}

export function Review() {
  // Note bodies aren't needed here, so they aren't fetched.
  const { data, isLoading, isError } = useSnapshot({ notes: false });
  const insights = useMemo(() => (data ? computeInsights(data) : null), [data]);

  return (
    <AppShell wide>
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">Review</h1>
      <p className="mt-1.5 text-[15px] text-muted-foreground">
        What you finished, what slipped, and what you've let go quiet.
      </p>

      {isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading…</p>}
      {isError && (
        <p className="mt-8 text-sm text-destructive">Couldn't load your data. Reload and try again.</p>
      )}

      {insights && (
        <>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="Done, last 7 days"
              value={insights.doneLast7}
              hint={
                insights.donePrev7 > 0 || insights.doneLast7 > 0
                  ? `${insights.donePrev7} the week before`
                  : undefined
              }
            />
            <Stat
              label="Current streak"
              value={`${insights.currentStreak}d`}
              hint={
                insights.currentStreak > 0
                  ? `best ${insights.longestStreak}d · one rest day is fine`
                  : "finish a task to start one"
              }
            />
            <Stat label="Active days, last 30" value={insights.activeDays30} hint="days you finished something" />
            <Stat label="Done, all time" value={insights.totalDone} />
          </div>

          <Section
            title="Activity"
            hint={`${insights.heatmapTotal} task${insights.heatmapTotal === 1 ? "" : "s"} finished in the last 26 weeks`}
          >
            <Heatmap columns={insights.heatmap} />
          </Section>

          {insights.overdue.length > 0 && (
            <Section title={`Slipped · ${insights.overdue.length}`} hint="Overdue and still open.">
              <TaskList items={insights.overdue} showDue />
              <SlippedActions taskIds={insights.overdue.map((o) => o.task.id)} />
            </Section>
          )}

          {insights.shakyTopics.length > 0 && (
            <Section
              title={`Shaky · ${insights.shakyTopics.length}`}
              hint="Topics you rated shaky. These come back for review sooner."
            >
              <ul>
                {insights.shakyTopics.slice(0, 10).map(({ topic, track }) => (
                  <li key={topic.id} className="border-b border-border last:border-0">
                    <Link
                      to={`/tracks/${track.id}?topic=${topic.id}`}
                      className="-mx-2 flex items-baseline justify-between gap-3 rounded-sm px-2 py-2.5 hover:bg-accent/50"
                    >
                      <span className="min-w-0 truncate text-[15px]">{topic.title}</span>
                      <span className="shrink-0 truncate text-xs text-muted-foreground">{track.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {insights.unratedDone.length > 0 && (
            <Section
              title={`Finished but unrated · ${insights.unratedDone.length}`}
              hint="Finished isn't the same as known. Tap Rate on a topic to say how well it stuck."
            >
              <ul>
                {insights.unratedDone.slice(0, 8).map(({ topic, track }) => (
                  <li key={topic.id} className="border-b border-border last:border-0">
                    <Link
                      to={`/tracks/${track.id}?topic=${topic.id}`}
                      className="-mx-2 flex items-baseline justify-between gap-3 rounded-sm px-2 py-2.5 hover:bg-accent/50"
                    >
                      <span className="min-w-0 truncate text-[15px]">{topic.title}</span>
                      <span className="shrink-0 truncate text-xs text-muted-foreground">{track.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {insights.staleTopics.length > 0 && (
            <Section
              title={`Gone quiet · ${insights.staleTopics.length}`}
              hint={`Topics you started but haven't touched in ${STALE_AFTER_DAYS}+ days.`}
            >
              <ul>
                {insights.staleTopics.slice(0, 10).map(({ topic, track, idleDays, openTasks }) => (
                  <li key={topic.id} className="border-b border-border last:border-0">
                    <Link
                      to={`/tracks/${track.id}?topic=${topic.id}`}
                      className="-mx-2 flex items-baseline justify-between gap-3 rounded-sm px-2 py-2.5 hover:bg-accent/50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[15px]">{topic.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {track.name} · {openTasks} open
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{idleDays}d idle</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {insights.idleTracks.length > 0 && (
            <Section
              title={`Drifting tracks · ${insights.idleTracks.length}`}
              hint="Nothing finished here lately. Keep going, pause it, or archive it."
            >
              <ul>
                {insights.idleTracks.map(({ track, idleDays, openTasks }) => (
                  <li key={track.id} className="border-b border-border last:border-0">
                    <Link
                      to={`/tracks/${track.id}`}
                      className="-mx-2 flex items-baseline justify-between gap-3 rounded-sm px-2 py-2.5 hover:bg-accent/50"
                    >
                      <span className="min-w-0 truncate text-[15px]">{track.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {openTasks} open · {idleDays}d idle
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {insights.dueSoon.length > 0 && (
            <Section title={`Coming up · ${insights.dueSoon.length}`} hint="Due in the next 7 days.">
              <TaskList items={insights.dueSoon} showDue />
            </Section>
          )}

          <Section
            title={`Finished this week · ${insights.completedLast7.length}`}
            hint={insights.completedLast7.length === 0 ? "Nothing yet — one tick starts the streak." : undefined}
          >
            <TaskList items={insights.completedLast7} />
          </Section>
        </>
      )}
    </AppShell>
  );
}
