import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { useSnapshot } from "../hooks/useSnapshot";
import { searchSnapshot } from "../lib/search";

function Group({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title} <span className="font-mono tabular-nums">· {count}</span>
      </h2>
      <ul className="mt-2">{children}</ul>
    </section>
  );
}

const ROW =
  "block border-b border-border py-3 transition-colors last:border-0 hover:bg-accent/50 -mx-2 px-2 rounded-sm";

export function Search() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const { data, isLoading, isError } = useSnapshot({ notes: true });

  const results = useMemo(() => (data ? searchSnapshot(data, q) : null), [data, q]);

  return (
    <AppShell wide>
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">Search</h1>
      <input
        autoFocus
        type="search"
        value={q}
        onChange={(e) => {
          const next = new URLSearchParams(params);
          if (e.target.value) next.set("q", e.target.value);
          else next.delete("q");
          setParams(next, { replace: true });
        }}
        placeholder="Search tasks, topics, tracks and notes…"
        aria-label="Search"
        className="mt-5 w-full rounded-md border border-input bg-background px-3 py-2 text-[15px] outline-none focus:border-ring focus:ring-1 focus:ring-ring"
      />

      {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading everything to search…</p>}
      {isError && (
        <p className="mt-6 text-sm text-destructive">Couldn't load your data to search. Reload and try again.</p>
      )}
      {results && !q.trim() && (
        <p className="mt-6 text-sm text-muted-foreground">
          Type to search across everything. Tip: press <kbd className="rounded border border-border px-1 font-mono text-xs">Ctrl</kbd>{" "}
          + <kbd className="rounded border border-border px-1 font-mono text-xs">K</kbd> anywhere to get here.
        </p>
      )}
      {results && q.trim() && results.total === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">Nothing matches “{q.trim()}”.</p>
      )}

      {results && (
        <>
          <Group title="Tracks" count={results.tracks.length}>
            {results.tracks.map(({ track }) => (
              <li key={track.id}>
                <Link to={`/tracks/${track.id}`} className={ROW}>
                  <span className="text-[15px]">{track.name}</span>
                  {track.status !== "active" && (
                    <span className="ml-2 text-xs text-muted-foreground">{track.status}</span>
                  )}
                </Link>
              </li>
            ))}
          </Group>

          <Group title="Topics" count={results.topics.length}>
            {results.topics.map(({ topic, track }) => (
              <li key={topic.id}>
                <Link to={`/tracks/${topic.track_id}?topic=${topic.id}`} className={ROW}>
                  <span className="text-[15px]">{topic.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{track?.name}</span>
                </Link>
              </li>
            ))}
          </Group>

          <Group title="Tasks" count={results.tasks.length}>
            {results.tasks.map(({ task, topic, track }) => (
              <li key={task.id}>
                <Link to={`/tracks/${task.track_id}?topic=${task.topic_id}`} className={ROW}>
                  <span
                    className={`text-[15px] ${task.done ? "text-muted-foreground line-through" : ""}`}
                  >
                    {task.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {track?.name} &rarr; {topic?.title}
                    {task.due_date && ` · due ${new Date(task.due_date).toLocaleDateString()}`}
                  </span>
                </Link>
              </li>
            ))}
          </Group>

          <Group title="Notes" count={results.notes.length}>
            {results.notes.map(({ note, snippet }) => (
              <li key={note.id}>
                <Link to={`/notes/${note.id}`} className={ROW}>
                  <span className="text-[15px]">{note.title || "Untitled"}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{snippet}</span>
                </Link>
              </li>
            ))}
          </Group>
        </>
      )}
    </AppShell>
  );
}
