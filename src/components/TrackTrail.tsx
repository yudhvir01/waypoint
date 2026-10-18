import { useState, type FormEvent, type ReactNode } from "react";
import type { Topic, Track } from "../lib/database.types";
import type { TrackProgress } from "../hooks/useTrackProgress";
import { useUpdateTrackDescription } from "../hooks/useTracks";
import { useAddWaypoint, useWaypoints } from "../hooks/useWaypoints";
import { todayKey, yesterdayKey } from "../hooks/useToday";

// A track drawn as the path it is: where it's headed at the top, the
// topics still ahead, a "you are here", and below that the trail of lines
// written on the days spent on it, back to the day it started. Read top
// down, it looks from the destination back to the start.

const AHEAD_SHOWN = 3;

function dayLabel(day: string): string {
  if (day === todayKey()) return "Today";
  if (day === yesterdayKey()) return "Yesterday";
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const sameYear = y === new Date().getFullYear();
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

// One stop on the path: a marker on the line, and what's beside it.
function Stop({
  marker,
  line = "solid",
  last = false,
  children,
}: {
  marker: "destination" | "ahead" | "here" | "day" | "start";
  // The line running down from this stop to the next one.
  line?: "solid" | "dashed";
  last?: boolean;
  children: ReactNode;
}) {
  const dot = {
    destination: "h-3 w-3 rounded-sm border-2 border-primary bg-background",
    ahead: "h-2.5 w-2.5 rounded-full border border-muted-foreground/40 bg-background",
    here: "h-3.5 w-3.5 rounded-full bg-primary ring-4 ring-primary/15",
    day: "h-2 w-2 rounded-full bg-primary/70",
    start: "h-2.5 w-2.5 rounded-full border-2 border-muted-foreground/50 bg-background",
  }[marker];

  return (
    <li className="relative flex gap-4 pb-7 last:pb-0">
      <div className="relative flex w-4 shrink-0 justify-center">
        {!last && (
          <span
            aria-hidden
            className={`absolute top-3 bottom-[-0.25rem] w-0 border-l ${
              line === "dashed" ? "border-dashed border-muted-foreground/30" : "border-border"
            }`}
          />
        )}
        <span aria-hidden className={`relative mt-1.5 ${dot}`} />
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}

function Destination({ track }: { track: Track }) {
  const update = useUpdateTrackDescription();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(track.description ?? "");

  function save(e: FormEvent) {
    e.preventDefault();
    update.mutate({ id: track.id, description: draft.trim() || null });
    setEditing(false);
  }

  if (editing) {
    return (
      <form onSubmit={save}>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Headed to</p>
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
          maxLength={300}
          placeholder="Why this track? Where does it end?"
          className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-1.5 text-[15px] outline-none focus:border-ring focus:ring-1 focus:ring-ring"
        />
        <div className="mt-2 flex gap-3">
          <button
            type="submit"
            className="rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Headed to</p>
      {track.description ? (
        <button
          type="button"
          onClick={() => {
            setDraft(track.description ?? "");
            setEditing(true);
          }}
          title="Edit where this is headed"
          className="mt-1 text-left text-[17px] font-medium leading-snug tracking-[-0.01em] hover:text-primary"
        >
          {track.description}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-1 text-left text-[15px] text-muted-foreground hover:text-primary"
        >
          Where is this headed? Add one sentence.
        </button>
      )}
    </div>
  );
}

function TodayLineForm({ trackId }: { trackId: string }) {
  const addWaypoint = useAddWaypoint();
  const [text, setText] = useState("");

  function save(e: FormEvent) {
    e.preventDefault();
    const line = text.trim();
    if (!line) return;
    addWaypoint.mutate({ trackId, day: todayKey(), text: line });
    setText("");
  }

  return (
    <form onSubmit={save} className="mt-3 flex gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={2000}
        placeholder="What did today move forward?"
        className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
      />
      <button
        type="submit"
        disabled={!text.trim()}
        className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
      >
        Add
      </button>
    </form>
  );
}

export function TrackTrail({
  track,
  topics,
  topicProgress,
  onOpenTopic,
}: {
  track: Track;
  topics: Topic[];
  topicProgress: Map<string, TrackProgress> | undefined;
  onOpenTopic: (topicId: string) => void;
}) {
  const { data: waypoints, isError } = useWaypoints();
  const [showPassed, setShowPassed] = useState(false);

  const lines = (waypoints ?? []).filter((w) => w.track_id === track.id);
  const passed = topics.filter((t) => t.status === "done");
  const current = topics.find((t) => t.status === "in_progress") ?? topics.find((t) => t.status !== "done");
  const ahead = topics.filter((t) => t.status !== "done" && t.id !== current?.id);
  const wroteToday = lines.some((w) => w.day === todayKey());
  const currentProgress = current ? topicProgress?.get(current.id) : undefined;
  const openInCurrent = currentProgress ? currentProgress.total - currentProgress.done : null;
  const started = new Date(track.created_at).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <ol className="mt-2">
      <Stop marker="destination" line={ahead.length > 0 || current ? "dashed" : "solid"}>
        <Destination key={track.description ?? ""} track={track} />
      </Stop>

      {/* Farthest first, so the next topic sits right above "you are here". */}
      {ahead.length > AHEAD_SHOWN && (
        <Stop marker="ahead" line="dashed">
          <span className="text-xs text-muted-foreground/70">
            {ahead.length - AHEAD_SHOWN} more beyond these
          </span>
        </Stop>
      )}
      {ahead
        .slice(0, AHEAD_SHOWN)
        .reverse()
        .map((topic) => (
          <Stop key={topic.id} marker="ahead" line="dashed">
            <button
              type="button"
              onClick={() => onOpenTopic(topic.id)}
              className="text-left text-sm text-muted-foreground hover:text-foreground"
            >
              {topic.title}
            </button>
          </Stop>
        ))}

      <Stop marker="here">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">You are here</p>
        {current ? (
          <button
            type="button"
            onClick={() => onOpenTopic(current.id)}
            className="mt-1 text-left text-[17px] font-medium leading-snug tracking-[-0.01em] hover:text-primary"
          >
            {current.title}
          </button>
        ) : (
          <p className="mt-1 text-[17px] font-medium leading-snug">
            {topics.length > 0 ? "Every topic is behind you." : "At the start. Add a first topic below."}
          </p>
        )}
        {openInCurrent !== null && openInCurrent > 0 && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {openInCurrent} task{openInCurrent === 1 ? "" : "s"} to go here
          </p>
        )}
        {passed.length > 0 && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowPassed((v) => !v)}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {passed.length} topic{passed.length === 1 ? "" : "s"} behind you {showPassed ? "▴" : "▾"}
            </button>
            {showPassed && (
              <ul className="mt-1.5 flex flex-col gap-1">
                {passed.map((topic) => (
                  <li key={topic.id}>
                    <button
                      type="button"
                      onClick={() => onOpenTopic(topic.id)}
                      className="text-left text-sm text-muted-foreground line-through decoration-muted-foreground/40 hover:text-foreground"
                    >
                      {topic.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {!isError && !wroteToday && <TodayLineForm trackId={track.id} />}
      </Stop>

      {lines.map((w) => (
        <Stop key={w.id} marker="day">
          <p className="text-xs text-muted-foreground">{dayLabel(w.day)}</p>
          <p className="mt-0.5 whitespace-pre-wrap text-[15px] leading-relaxed">{w.text}</p>
        </Stop>
      ))}

      <Stop marker="start" last>
        <p className="text-xs text-muted-foreground">Set out · {started}</p>
        {lines.length === 0 && !isError && (
          <p className="mt-1 text-sm text-muted-foreground/80">
            The lines you write when closing a day collect here, one stop per day.
          </p>
        )}
      </Stop>
    </ol>
  );
}
