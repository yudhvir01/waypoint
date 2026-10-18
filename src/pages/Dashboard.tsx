import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { ImportMarkdownDialog } from "../components/ImportMarkdownDialog";
import { useCreateTrack, useTracks } from "../hooks/useTracks";
import { useFocusNow, type FocusTask } from "../hooks/useFocusNow";
import { useToggleTask } from "../hooks/useTasks";
import { MAX_PICKS, todayKey, usePlannedTasks, usePlanTasks, yesterdayKey } from "../hooks/useToday";
import { useAddWaypoint, useDeleteWaypoint, useWaypoints } from "../hooks/useWaypoints";
import { useCards } from "../hooks/useCards";
import { useTrackProgress } from "../hooks/useTrackProgress";
import { isDue } from "../lib/cards";
import { findTodoTrack, isTodoTrack, TODO_NAME } from "../lib/inbox";
import type { Task } from "../lib/database.types";
import { RECURRENCE_LABEL } from "../lib/recurrence";
import { useFocusTimer } from "../context/FocusTimerProvider";
import { TaskDetailSheet } from "../components/TaskDetailSheet";
import { LIMITS } from "../lib/limits";
import { Tip } from "../components/Tip";
import { DEADLINE_TONE_CLASS, deadlineLabel } from "../lib/deadline";
import { isReviewTask } from "../lib/taskActions";
import { useImportTrack } from "../hooks/useImportTrack";
import { parseImportMarkdown } from "../lib/markdownImport";

const PRIORITY_DOT: Record<Task["priority"], string> = {
  high: "bg-destructive",
  medium: "bg-amber-500",
  low: "bg-muted-foreground",
  none: "bg-transparent",
};

// Overdue and still open — what Review's "Slipped" lists.
function isSlipped(task: FocusTask): boolean {
  return !task.done && !!task.due_date && task.due_date < todayKey();
}

const SUGGESTED = 6;
const PER_TRACK = 2;

// Suggested takes at most two tasks from each track, so one busy track
// (or the one you happen to be in the middle of) can't push your other
// goals off Today. A crossed deadline always gets through: that one
// genuinely needs you. The order within the ranking is kept.
function balanceByTrack(ranked: FocusTask[]): FocusTask[] {
  const perTrack = new Map<string, number>();
  const shown: FocusTask[] = [];
  for (const task of ranked) {
    if (shown.length >= SUGGESTED) break;
    const count = perTrack.get(task.topic.track.id) ?? 0;
    if (count >= PER_TRACK && !isSlipped(task)) continue;
    perTrack.set(task.topic.track.id, count + 1);
    shown.push(task);
  }
  return shown;
}

function TaskRow({
  task,
  onOpen,
  trailing,
}: {
  task: FocusTask;
  onOpen: () => void;
  // What sits at the row's end besides the deadline: pick, unpick, or
  // nothing.
  trailing?: ReactNode;
}) {
  const toggleTask = useToggleTask();
  const timer = useFocusTimer();
  const due = deadlineLabel(task.due_date, task.done);
  const focusing = timer.state.phase === "focus" && timer.state.taskId === task.id;

  return (
    <li
      className={`flex items-start gap-3 border-b border-border py-4 last:border-0 ${
        focusing ? "-mx-3 rounded-lg bg-primary/5 px-3" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => toggleTask.mutate(task)}
        aria-label={task.done ? "Mark not done" : "Mark done"}
        title={task.done ? "Mark not done" : "Mark done"}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          task.done ? "border-primary bg-primary text-primary-foreground" : "border-input hover:border-primary"
        }`}
      >
        {task.done && (
          <svg viewBox="0 0 12 12" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M2.5 6.5l2.2 2.2 4.8-5" />
          </svg>
        )}
      </button>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open task: ${task.title}`}
        className="min-w-0 flex-1 rounded-md text-left outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring"
      >
        <p className={`text-[15px] leading-snug ${task.done ? "text-muted-foreground line-through" : ""}`}>
          {task.title}
          {focusing && (
            <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 align-middle text-[11px] font-medium text-primary">
              Focusing
            </span>
          )}
          {task.recurrence && (
            <span
              className="ml-1.5 text-xs text-muted-foreground"
              title={RECURRENCE_LABEL[task.recurrence]}
              aria-label={RECURRENCE_LABEL[task.recurrence]}
            >
              ↻
            </span>
          )}
        </p>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          {task.priority !== "none" && (
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`}
              title={`${task.priority[0].toUpperCase()}${task.priority.slice(1)} priority`}
            />
          )}
          <span className="min-w-0 truncate">
            {/* The To do list has no topics to speak of. */}
            {isTodoTrack(task.topic.track) ? (
              TODO_NAME
            ) : task.topic.title === task.topic.track.name ? (
              task.topic.track.name
            ) : (
              <>
                {task.topic.track.name} &rarr; {task.topic.title}
              </>
            )}
          </span>
        </div>
        {due && <p className={`mt-0.5 text-xs ${DEADLINE_TONE_CLASS[due.tone]}`}>{due.text}</p>}
      </button>
      {!task.done && (
        <RowAction label="Start a focus timer on this task" onClick={() => timer.start({ id: task.id, title: task.title })}>
          ▶ Focus
        </RowAction>
      )}
      {trailing}
    </li>
  );
}

function RowAction({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="shrink-0 whitespace-nowrap rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
    >
      {children}
    </button>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</p>;
}

// Opening the day: the app suggests, you pick at most three. Picking is
// the ritual — the list is yours, not something computed at you — and
// whatever's left of yesterday's picks is offered first rather than
// silently dropped.
function TodayPlan() {
  const { data: planned, isError: plannedError } = usePlannedTasks();
  const { data: ranked, isLoading, isError, refetch } = useFocusNow();
  const plan = usePlanTasks();
  const toggleTask = useToggleTask();
  const [openId, setOpenId] = useState<string | null>(null);
  const [showRest, setShowRest] = useState(false);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  // A failed query used to fall through to the empty state, so a network
  // or permissions problem read as "you're all caught up".
  if (isError) {
    return (
      <div className="py-6">
        <p className="text-[15px] text-destructive">Couldn't load your tasks.</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-2 text-sm text-primary hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  const today = todayKey();
  const picks = (planned ?? [])
    .filter((t) => t.planned_on === today)
    .sort((a, b) => Number(a.done) - Number(b.done));
  const pickedIds = new Set(picks.map((t) => t.id));
  const carried = (planned ?? []).filter((t) => t.planned_on !== today && !t.done && !pickedIds.has(t.id));
  const carriedIds = new Set(carried.map((t) => t.id));
  // A review set for later stays out of the way until its day comes.
  const rest = (ranked ?? []).filter(
    (t) =>
      !pickedIds.has(t.id) &&
      !carriedIds.has(t.id) &&
      !(isReviewTask(t) && !!t.due_date && t.due_date > today),
  );
  const openPicks = picks.filter((t) => !t.done).length;
  const canPick = !plannedError && openPicks < MAX_PICKS;

  const suggested = plannedError ? rest.slice(0, 8) : balanceByTrack(rest);
  const suggestedIds = new Set(suggested.map((t) => t.id));
  const more = rest.filter((t) => !suggestedIds.has(t.id));
  const all = [...picks, ...carried, ...rest];
  const open = openId ? all.find((t) => t.id === openId) : undefined;

  const pick = (task: FocusTask) => plan.mutate({ taskIds: [task.id], day: today });
  const pickAction = (task: FocusTask) =>
    canPick ? (
      <RowAction label="Pick for today" onClick={() => pick(task)}>
        + Today
      </RowAction>
    ) : null;

  return (
    <div className="flex flex-col gap-9">
      {all.length > 0 && (
        <Tip id="today" title="How Today works">
          <ul>
            <li>
              Tap <b>+ Today</b> on up to three tasks you'll do today. They move to the top.
            </li>
            <li>
              Tap the <b>circle</b> when a task is finished, or <b>▶ Focus</b> to time yourself working on it.
            </li>
            <li>Tap a task's name for its details: deadline, priority, repeat and notes.</li>
            <li>
              In the evening, write one line under <b>Close the day</b> about what moved.
            </li>
          </ul>
        </Tip>
      )}

      {plannedError && (
        <p className="text-sm text-muted-foreground">
          Picking tasks for the day needs the latest <code>setup.sql</code> — re-run it in your Supabase project.
        </p>
      )}

      {!plannedError && (
        <div>
          {picks.length === 0 ? (
            <>
              <p className="text-[17px] font-medium tracking-[-0.01em]">Pick up to three for today.</p>
              <p className="mt-1 text-sm text-muted-foreground">Small enough to finish. Everything else can wait.</p>
            </>
          ) : (
            <>
              <SectionLabel>
                {openPicks === 0 ? "Today · all done" : `Today · ${picks.length - openPicks} of ${picks.length} done`}
              </SectionLabel>
              <ul className="mt-2">
                {picks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onOpen={() => setOpenId(task.id)}
                    trailing={
                      !task.done && (
                        <RowAction label="Take off today's list" onClick={() => plan.mutate({ taskIds: [task.id], day: null })}>
                          Not today
                        </RowAction>
                      )
                    }
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {canPick && carried.length > 0 && (
        <div>
          <SectionLabel>Left from yesterday</SectionLabel>
          <ul className="mt-2">
            {carried.map((task) => (
              <TaskRow key={task.id} task={task} onOpen={() => setOpenId(task.id)} trailing={pickAction(task)} />
            ))}
          </ul>
        </div>
      )}

      {(canPick || plannedError) && rest.length > 0 && (
        <div>
          <SectionLabel>{plannedError ? "Focus now" : "Suggested"}</SectionLabel>
          <ul className="mt-2">
            {suggested.map((task) => (
              <TaskRow key={task.id} task={task} onOpen={() => setOpenId(task.id)} trailing={pickAction(task)} />
            ))}
          </ul>
          {canPick && more.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowRest((v) => !v)}
                className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
              >
                {showRest ? "Show less" : `More from your tracks · ${more.length}`}
              </button>
              {showRest && (
                <ul className="mt-2">
                  {more.map((task) => (
                    <TaskRow key={task.id} task={task} onOpen={() => setOpenId(task.id)} trailing={pickAction(task)} />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {canPick && rest.length === 0 && carried.length === 0 && picks.length === 0 && (
        <div>
          <p className="text-[15px]">Nothing needs your attention.</p>
          <p className="mt-1 text-sm text-muted-foreground">You're clear for today.</p>
        </div>
      )}

      {!canPick && !plannedError && rest.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowRest((v) => !v)}
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
          >
            {showRest ? "Hide the rest" : `Everything else · ${rest.length}`}
          </button>
          {showRest && (
            <ul className="mt-2">
              {rest.map((task) => (
                <TaskRow key={task.id} task={task} onOpen={() => setOpenId(task.id)} />
              ))}
            </ul>
          )}
        </div>
      )}

      {open && (
        <TaskDetailSheet
          key={open.id}
          task={open}
          place={{
            trackId: open.topic.track.id,
            trackName: open.topic.track.name,
            topicId: open.topic.id,
            topicTitle: open.topic.title,
          }}
          onToggleDone={() => toggleTask.mutate(open)}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

// The other things that want a moment of the day, as one quiet line.
// Each also has its own place in the sidebar; this says when it needs you.
function DayLinks() {
  const { data: ranked } = useFocusNow();
  const { data: cards } = useCards();
  const { data: tracks } = useTracks();
  const { data: progress } = useTrackProgress();

  const dueCards = cards ? cards.filter((c) => isDue(c)).length : 0;
  const todo = findTodoTrack(tracks);
  const todoProgress = todo ? progress?.get(todo.id) : undefined;
  const todoOpen = todoProgress ? todoProgress.total - todoProgress.done : 0;
  const slipped = (ranked ?? []).filter(isSlipped).length;

  const links: { to: string; label: string }[] = [];
  if (dueCards > 0) links.push({ to: "/cards", label: `${dueCards} card${dueCards === 1 ? "" : "s"} to review` });
  if (todo && todoOpen > 0) links.push({ to: `/tracks/${todo.id}`, label: `${todoOpen} on your ${TODO_NAME} list` });
  if (slipped > 0) links.push({ to: "/review", label: `${slipped} slipped` });
  if (links.length === 0) return null;

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
      {links.map((link, i) => (
        <span key={link.to} className="flex items-center gap-2">
          {i > 0 && <span className="text-border">·</span>}
          <Link to={link.to} className="transition-colors hover:text-primary hover:underline">
            {link.label}
          </Link>
        </span>
      ))}
    </p>
  );
}

// Closing the day: one line of what you learned or got done. Each line is
// a waypoint on its track's trail.
function CloseTheDay() {
  const { data: waypoints, isError } = useWaypoints();
  const { data: planned } = usePlannedTasks();
  const { data: tracks } = useTracks();
  const addWaypoint = useAddWaypoint();
  const deleteWaypoint = useDeleteWaypoint();
  const [text, setText] = useState("");
  const [trackChoice, setTrackChoice] = useState<string | null | undefined>(undefined);
  const [writingAnother, setWritingAnother] = useState(false);

  const today = todayKey();
  const written = (waypoints ?? []).filter((w) => w.day === today);
  const trackName = new Map((tracks ?? []).map((t) => [t.id, t.name]));

  // Unless chosen, the line goes on the track today's finished picks
  // mostly came from.
  const doneToday = (planned ?? []).filter((t) => t.planned_on === today && t.done);
  const tally = new Map<string, number>();
  for (const t of doneToday) tally.set(t.track_id, (tally.get(t.track_id) ?? 0) + 1);
  const likely = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const trackId = trackChoice === undefined ? likely : trackChoice;

  if (isError) {
    return (
      <div>
        <SectionLabel>Close the day</SectionLabel>
        <p className="mt-2 text-sm text-muted-foreground">
          Writing the day's line needs the latest <code>setup.sql</code> — re-run it in your Supabase project.
        </p>
      </div>
    );
  }

  function save(e: FormEvent) {
    e.preventDefault();
    const line = text.trim();
    if (!line) return;
    addWaypoint.mutate({ trackId, day: today, text: line });
    setText("");
    setWritingAnother(false);
  }

  const showForm = written.length === 0 || writingAnother;

  return (
    <div>
      <SectionLabel>{written.length > 0 ? "Today's waypoint" : "Close the day"}</SectionLabel>
      {written.length === 0 && (
        <p className="mt-1 text-sm text-muted-foreground">
          One line about what you did or learned. It's saved on the track's trail, so you can look back later.
        </p>
      )}

      {written.length > 0 && (
        <ul className="mt-3 flex flex-col gap-3">
          {written.map((w) => (
            <li key={w.id} className="group flex items-start gap-3">
              <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-primary" />
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{w.text}</p>
                {w.track_id && trackName.get(w.track_id) && (
                  <Link to={`/tracks/${w.track_id}`} className="text-xs text-muted-foreground hover:text-primary">
                    on {trackName.get(w.track_id)}
                  </Link>
                )}
              </div>
              <button
                type="button"
                onClick={() => deleteWaypoint.mutate(w.id)}
                aria-label="Delete this line"
                title="Delete this line"
                className="shrink-0 rounded px-1 text-xs text-muted-foreground/50 opacity-0 transition hover:text-destructive group-hover:opacity-100 focus:opacity-100"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
        <form onSubmit={save} className="mt-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            rows={2}
            maxLength={2000}
            placeholder="What did you learn or get done today?"
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-[15px] leading-relaxed outline-none focus:border-ring focus:ring-1 focus:ring-ring"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <label className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
              on
              <select
                value={trackId ?? ""}
                onChange={(e) => setTrackChoice(e.target.value || null)}
                className="min-w-0 max-w-[14rem] truncate rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-ring"
              >
                <option value="">No track</option>
                {(tracks ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-3">
              {writingAnother && (
                <button
                  type="button"
                  onClick={() => setWritingAnother(false)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={!text.trim()}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                Save the day
              </button>
            </div>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setWritingAnother(true)}
          className="mt-3 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          + Another line
        </button>
      )}
    </div>
  );
}

// What you wrote yesterday, so a day starts from where the last one ended.
function YesterdayLine() {
  const { data: waypoints } = useWaypoints();
  const yesterday = yesterdayKey();
  const line = (waypoints ?? []).find((w) => w.day === yesterday);
  if (!line) return null;
  return (
    <p className="mt-4 border-l-2 border-border pl-3 text-sm italic leading-relaxed text-muted-foreground">
      Yesterday: {line.text}
    </p>
  );
}

function NewTrackMenu({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"manual" | "import" | null>(null);
  const [name, setName] = useState("");
  const createTrack = useCreateTrack();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createTrack.mutate({ name: name.trim() });
    setName("");
    setMode(null);
    setOpen(false);
  }

  if (mode === "import") {
    return <ImportMarkdownDialog onClose={() => { setMode(null); setOpen(false); }} />;
  }

  if (mode === "manual") {
    return (
      <form onSubmit={handleSubmit} className="flex w-full items-center gap-2 sm:w-auto">
        <input
          autoFocus
          value={name}
          maxLength={LIMITS.trackName}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => !name && setMode(null)}
          placeholder="Track name"
          className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring sm:w-56 sm:flex-none"
        />
        <button
          type="submit"
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          Add
        </button>
      </form>
    );
  }

  if (!open) {
    if (compact) {
      return (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setMode("manual")}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Start my own track
          </button>
          <button
            type="button"
            onClick={() => setMode("import")}
            className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            Paste a plan (from AI or a file)
          </button>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary hover:bg-accent hover:text-primary"
      >
        + Add track
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-card p-1 text-sm">
      <button
        type="button"
        onClick={() => setMode("manual")}
        className="rounded px-2.5 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        Type a name
      </button>
      <span className="text-border">·</span>
      <button
        type="button"
        onClick={() => setMode("import")}
        className="rounded px-2.5 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        Paste a plan
      </button>
    </div>
  );
}

// A track that teaches the app by being used: each task is one thing to
// try. Its one deadline is today, so it shows up on Today straight away.
function sampleTrack(today: string): string {
  return `# Getting started with Waypoint
Know your way around, then start a track of your own.

## Your first day
- [ ] Tap + Today on this task to pick it for today #priority:high
- [ ] Tap a task's name to see its details and notes
- [ ] Start a timer on a task with ▶ Focus
- [ ] Write one line under Close the day this evening #due:${today}

## Make it yours
- [ ] Start a track for something you're learning or building
- [ ] Write a note and type [[ to link it to another note
- [ ] In a note, write a line like "What is 2 + 2? :: 4" to make a flashcard
- [ ] Archive this sample track from its page when you're done
`;
}

const WELCOME_STEPS: { title: string; text: string }[] = [
  {
    title: "Make a track for each goal",
    text: "Like “Learn Rust” or “Plan the wedding”. Split it into topics, and topics into small tasks.",
  },
  {
    title: "Each morning, pick up to three tasks",
    text: "Today suggests what's due or important. Pick what you'll actually finish.",
  },
  {
    title: "Each evening, write one line",
    text: "What moved today. Those lines become each track's trail, so you can see how far you've come.",
  },
];

function Welcome() {
  const importTrack = useImportTrack();
  const [error, setError] = useState(false);

  async function trySample() {
    setError(false);
    try {
      await importTrack.mutateAsync(parseImportMarkdown(sampleTrack(todayKey())));
    } catch {
      setError(true);
    }
  }

  return (
    <div className="py-10">
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">Welcome to Waypoint</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">
        A simple place to plan what you're learning or building, one day at a time. Here's the whole idea:
      </p>

      <ol className="mt-7 flex flex-col gap-5">
        {WELCOME_STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {i + 1}
            </span>
            <div>
              <p className="text-[15px] font-medium">{step.title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-9 rounded-lg border border-border bg-card p-5">
        <p className="text-[15px] font-medium">Not sure where to start?</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a short sample track that shows you around. Each task is one thing to try, and you can archive
          it when you're done.
        </p>
        <button
          type="button"
          onClick={() => void trySample()}
          disabled={importTrack.isPending}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {importTrack.isPending ? "Adding…" : "Try a sample track"}
        </button>
        {error && <p className="mt-2 text-xs text-destructive">Couldn't add it. Check your connection and try again.</p>}
      </div>

      <p className="mt-8 text-sm text-muted-foreground">Or start with your own goal:</p>
      <div className="mt-3">
        <NewTrackMenu compact />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        <b className="font-medium text-foreground">Paste a plan</b> gives you a prompt for ChatGPT, Claude or any AI:
        it asks about your goal, then writes the whole track for you to paste back.
      </p>
    </div>
  );
}

export function Dashboard() {
  const { data: tracks, isLoading: tracksLoading, isError: tracksError } = useTracks();
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // Only show the "empty workspace" onboarding when we actually know the
  // workspace is empty — not when the request failed.
  if (!tracksLoading && !tracksError && tracks?.length === 0) {
    return (
      <AppShell>
        <Welcome />
      </AppShell>
    );
  }

  return (
    <AppShell wide>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Today</h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">{today}</p>
        </div>
        <NewTrackMenu />
      </div>
      <YesterdayLine />

      <div className="mt-9 flex flex-col gap-10">
        <TodayPlan />
        <DayLinks />
        <div className="border-t border-border pt-8">
          <CloseTheDay />
        </div>
      </div>
    </AppShell>
  );
}
