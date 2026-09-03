import { useRef, useState, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { parseImportMarkdown, type ParsedImport } from "../lib/markdownImport";
import { IMPORT_AI_PROMPT } from "../lib/importPrompt";
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
  const [promptCopied, setPromptCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importTrack = useImportTrack();

  async function loadFile(file: File) {
    const content = await file.text();
    setText(content);
    setParseError(null);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    e.target.value = "";
  }

  function handleDrop(e: DragEvent<HTMLTextAreaElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  }

  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(IMPORT_AI_PROMPT);
      setCopyError(false);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
    } catch {
      setCopyError(true);
    }
  }

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
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Got messy notes instead of this format? Copy the prompt below
                  and hand it to an AI along with your notes.
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".md,.markdown,text/markdown,text/plain"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    Upload .md file
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    {promptCopied ? "Copied!" : copyError ? "Couldn't copy" : "Copy AI prompt"}
                  </button>
                </div>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                placeholder={PLACEHOLDER}
                rows={12}
                className={`mt-3 w-full rounded-md border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring ${
                  isDragging ? "border-primary bg-accent" : "border-input"
                }`}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Paste text above, or drag a .md file onto it.
              </p>
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
