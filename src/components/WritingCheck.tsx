import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";
import { checkGrammar, MAX_CHECK_LENGTH, type GrammarIssue } from "../lib/grammar";

// An issue pinned to a stretch of the document. from/to follow edits
// (mapped through each transaction), and `text` is what was there when it
// was found: once the text there changes, the issue no longer applies.
type Issue = GrammarIssue & { id: number; from: number; to: number; text: string };

// The note as plain text for the checker, with each character's document
// position so its offsets can be turned back into a range to fix.
// Paragraphs are separated by a blank line, so sentences don't run
// together across them; separators and attachments map to -1.
function noteText(doc: PMNode): { text: string; positions: number[] } {
  let text = "";
  const positions: number[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    if (text) {
      text += "\n\n";
      positions.push(-1, -1);
    }
    node.forEach((child, offset) => {
      if (child.isText && child.text) {
        text += child.text;
        for (let i = 0; i < child.text.length; i++) positions.push(pos + 1 + offset + i);
      } else {
        text += "\n";
        positions.push(-1);
      }
    });
    return false;
  });
  return { text, positions };
}

const KIND_STYLE: Record<GrammarIssue["kind"], string> = {
  spelling: "text-destructive",
  grammar: "text-amber-600 dark:text-amber-400",
  style: "text-primary",
};

// "Check writing" next to Image and Audio: sends the note's text to the
// grammar checker and lists what it finds, each with one-tap fixes.
export function WritingCheck({ editor }: { editor: Editor }) {
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [status, setStatus] = useState<"idle" | "checking">("idle");
  const [error, setError] = useState<string | null>(null);

  // Keep every issue on its text as the note changes.
  useEffect(() => {
    if (!issues?.length) return;
    function follow({ transaction: tr }: { transaction: Transaction }) {
      if (!tr.docChanged) return;
      setIssues((current) =>
        current
          ? current
              .map((i) => ({ ...i, from: tr.mapping.map(i.from, 1), to: tr.mapping.map(i.to, -1) }))
              .filter((i) => i.to > i.from && tr.doc.textBetween(i.from, i.to) === i.text)
          : current,
      );
    }
    editor.on("transaction", follow);
    return () => {
      editor.off("transaction", follow);
    };
  }, [editor, issues?.length]);

  async function run() {
    const { text, positions } = noteText(editor.state.doc);
    setError(null);
    if (!text.trim()) {
      setError("Nothing to check yet.");
      return;
    }
    if (text.length > MAX_CHECK_LENGTH) {
      setError("This note is too long to check in one go.");
      return;
    }
    setStatus("checking");
    try {
      const found = await checkGrammar(text);
      const doc = editor.state.doc;
      setIssues(
        found.flatMap((g, id) => {
          const from = positions[g.offset];
          const last = positions[g.offset + g.length - 1];
          // Skip anything that spans a paragraph break or an attachment.
          if (from === undefined || last === undefined || from < 0 || last - from !== g.length - 1) return [];
          return [{ ...g, id, from, to: last + 1, text: doc.textBetween(from, last + 1) }];
        }),
      );
    } catch (e) {
      setError(e instanceof Error && e.message.startsWith("Too many") ? e.message : "Couldn't reach the grammar checker. Check your connection.");
    }
    setStatus("idle");
  }

  function fix(issue: Issue, replacement: string) {
    editor.view.dispatch(editor.state.tr.insertText(replacement, issue.from, issue.to));
  }

  function show(issue: Issue) {
    editor.chain().focus().setTextSelection({ from: issue.from, to: issue.to }).scrollIntoView().run();
  }

  function dismiss(issue: Issue) {
    setIssues((current) => current?.filter((i) => i.id !== issue.id) ?? null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void run()}
        disabled={status === "checking"}
        title="Check spelling, grammar and style"
        className="flex h-7 items-center gap-1.5 rounded px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60"
      >
        <CheckIcon />
        {status === "checking" ? "Checking…" : "Check writing"}
      </button>
      {error && <span className="text-xs text-destructive">{error}</span>}

      {issues && (
        <div className="mt-1 basis-full rounded-lg border border-border bg-card text-sm">
          <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
            <span className="text-xs text-muted-foreground">
              {issues.length === 0
                ? "No problems found."
                : `${issues.length} suggestion${issues.length === 1 ? "" : "s"}. Tap one to find it in the note.`}
            </span>
            <button
              type="button"
              onClick={() => setIssues(null)}
              className="rounded px-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Close
            </button>
          </div>
          {issues.length > 0 && (
            <ul className="max-h-72 divide-y divide-border overflow-y-auto">
              {issues.map((issue) => (
                <li key={issue.id} className="px-3 py-2">
                  <button type="button" onClick={() => show(issue)} className="block w-full text-left">
                    <span className={`text-[11px] font-medium uppercase tracking-wide ${KIND_STYLE[issue.kind]}`}>
                      {issue.kind}
                    </span>
                    <span className="ml-2 font-medium line-through decoration-muted-foreground/60">{issue.text}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{issue.message}</span>
                  </button>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {issue.replacements.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => fix(issue, r)}
                        className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/20"
                      >
                        {r === "" ? "Remove" : r}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => dismiss(issue)}
                      className="rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent"
                    >
                      Ignore
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4.5h7M2 8h5M2 11.5h3.5" />
      <path d="M8.5 11l2 2 4-4.5" />
    </svg>
  );
}
