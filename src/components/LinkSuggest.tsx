import { useEffect, useMemo, useState, type MutableRefObject } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { useNotes } from "../hooks/useNotes";

const MAX_SUGGESTIONS = 6;

// What's typed after an unclosed "[[" before the cursor, and where it starts.
function openLink(editor: Editor): { query: string; from: number; to: number } | null {
  const { selection } = editor.state;
  if (!selection.empty) return null;
  const { $from } = selection;
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, "￼");
  const match = /\[\[([^[\]|\n￼]{0,80})$/.exec(before);
  if (!match) return null;
  // Swallow a "]]" right after the cursor, so picking a title inside
  // "[[Ra|]]" doesn't leave "[[RAII]]]]".
  const after = $from.parent.textBetween($from.parentOffset, $from.parent.content.size, undefined, "￼");
  const close = after.startsWith("]]") ? 2 : 0;
  return { query: match[1], from: $from.pos - match[1].length, to: $from.pos + close };
}

// Note titles that match, best first: titles starting with the query,
// then ones with a word starting with it, then anywhere.
function rank(titles: string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  const score = (t: string) => {
    const l = t.toLowerCase();
    if (!q) return 0;
    if (l.startsWith(q)) return 0;
    if (l.split(/\s+/).some((w) => w.startsWith(q))) return 1;
    return l.includes(q) ? 2 : -1;
  };
  return titles
    .map((t) => [t, score(t)] as const)
    .filter(([, s]) => s >= 0)
    .sort((a, b) => a[1] - b[1])
    .slice(0, MAX_SUGGESTIONS)
    .map(([t]) => t);
}

// Typing "[[" in a note lists the titles of notes already written, and
// picking one completes the link. ↑/↓ move, Enter or Tab picks, Esc closes.
// keyHandlerRef is how the editor's own key handling hands those keys
// here first, while the list is open.
export function LinkSuggest({
  editor,
  keyHandlerRef,
}: {
  editor: Editor;
  keyHandlerRef: MutableRefObject<((event: KeyboardEvent) => boolean) | null>;
}) {
  const { data: notes } = useNotes();
  const link = useEditorState({ editor, selector: ({ editor: e }) => openLink(e) });
  // The highlighted row, reset to the first whenever the query changes.
  const [cursor, setCursor] = useState({ query: "", index: 0 });
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  // Task notes carry their task's title, so they're listed too.
  const titles = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const n of notes ?? []) {
      const title = n.title.trim();
      if (!title || seen.has(title.toLowerCase())) continue;
      seen.add(title.toLowerCase());
      out.push(title);
    }
    return out;
  }, [notes]);

  const matches = useMemo(() => (link ? rank(titles, link.query) : []), [titles, link]);
  const open = !!link && matches.length > 0 && dismissedAt !== link.from;

  const active = cursor.query === link?.query ? cursor.index : 0;
  const setActive = (index: number) => setCursor({ query: link?.query ?? "", index });

  function pick(title: string) {
    if (!link) return;
    editor.chain().focus().insertContentAt({ from: link.from, to: link.to }, `${title}]]`).run();
  }

  useEffect(() => {
    keyHandlerRef.current = open
      ? (event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            const step = event.key === "ArrowDown" ? 1 : -1;
            setActive((active + step + matches.length) % matches.length);
            return true;
          }
          if (event.key === "Enter" || event.key === "Tab") {
            pick(matches[Math.min(active, matches.length - 1)]);
            return true;
          }
          if (event.key === "Escape") {
            setDismissedAt(link!.from);
            return true;
          }
          return false;
        }
      : null;
  });

  if (!open) return null;

  const coords = editor.view.coordsAtPos(link.from);
  return (
    <ul
      role="listbox"
      aria-label="Link to a note"
      style={{ left: Math.max(8, Math.min(coords.left, window.innerWidth - 248)), top: coords.bottom + 6 }}
      className="fixed z-50 w-60 overflow-hidden rounded-lg border border-border bg-popover py-1 text-sm shadow-lg"
    >
      {matches.map((title, i) => (
        <li key={title} role="option" aria-selected={i === active}>
          <button
            type="button"
            // mousedown, so the editor keeps focus and the cursor stays put.
            onMouseDown={(e) => {
              e.preventDefault();
              pick(title);
            }}
            onMouseEnter={() => setActive(i)}
            className={`block w-full truncate px-3 py-1.5 text-left ${i === active ? "bg-accent text-foreground" : "text-foreground/90"}`}
          >
            {title}
          </button>
        </li>
      ))}
    </ul>
  );
}
