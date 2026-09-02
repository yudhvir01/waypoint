import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { parseImportMarkdown, type ParsedImport } from "../lib/markdownImport";
import { useImportTrack } from "../hooks/useImportTrack";

const PLACEHOLDER = `# Track Name
Optional description line before the first ##.

## Topic Title
- [ ] Task text #priority:high #due:2026-09-10
- [x] Completed task
- [ ] Task with no tags`;

export function ImportMarkdownDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const importTrack = useImportTrack();

  function handlePreview() {
    setParseError(null);
    setParsed(null);
    try {
      setParsed(parseImportMarkdown(text));
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Couldn't parse that file.");
    }
  }

  async function handleImport() {
    if (!parsed) return;
    const track = await importTrack.mutateAsync(parsed);
    onClose();
    navigate(`/tracks/${track.id}`);
  }

  const taskCount = parsed?.topics.reduce((sum, t) => sum + t.tasks.length, 0) ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-2xl flex-col rounded-lg border border-border bg-card text-card-foreground shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Import from Markdown</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {!parsed && (
            <>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={PLACEHOLDER}
                rows={12}
                className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
              />
              {parseError && <p className="mt-2 text-sm text-destructive">{parseError}</p>}
            </>
          )}

          {parsed && (
            <div>
              <p className="text-sm">
                <span className="font-medium">{parsed.trackName}</span>
                {" — "}
                {parsed.topics.length} topic{parsed.topics.length === 1 ? "" : "s"}, {taskCount} task
                {taskCount === 1 ? "" : "s"}
              </p>
              {parsed.description && (
                <p className="mt-1 text-sm text-muted-foreground">{parsed.description}</p>
              )}

              <ul className="mt-4 flex flex-col gap-3">
                {parsed.topics.map((topic, i) => (
                  <li key={i}>
                    <p className="text-sm font-medium">{topic.title}</p>
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {topic.tasks.map((task, j) => (
                        <li key={j} className="ml-4 text-sm text-muted-foreground">
                          <span className={task.done ? "line-through" : ""}>{task.title}</span>
                          {task.priority !== "none" && ` · ${task.priority}`}
                          {task.dueDate && ` · due ${task.dueDate}`}
                        </li>
                      ))}
                      {topic.tasks.length === 0 && (
                        <li className="ml-4 text-sm text-muted-foreground">No tasks</li>
                      )}
                    </ul>
                  </li>
                ))}
              </ul>

              {parsed.warnings.length > 0 && (
                <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                    {parsed.warnings.length} warning{parsed.warnings.length === 1 ? "" : "s"}
                  </p>
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {parsed.warnings.map((w, i) => (
                      <li key={i} className="text-xs text-muted-foreground">
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {importTrack.isError && (
                <p className="mt-3 text-sm text-destructive">
                  {importTrack.error instanceof Error
                    ? importTrack.error.message
                    : "Import failed."}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          {!parsed && (
            <button
              type="button"
              onClick={handlePreview}
              disabled={!text.trim()}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              Preview
            </button>
          )}
          {parsed && (
            <>
              <button
                type="button"
                onClick={() => setParsed(null)}
                className="text-sm text-muted-foreground hover:underline"
              >
                ← Edit
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={importTrack.isPending}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
              >
                {importTrack.isPending ? "Importing…" : "Import"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
