import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { Color, FontSize, TextStyle } from "@tiptap/extension-text-style";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import {
  AttachmentAudio,
  AttachmentImage,
  insertFilesAt,
  LinkPreviewNode,
  LinkPreviewPaste,
} from "./noteAttachments";
import { useBackend } from "../context/BackendProvider";
import type { Backend } from "../lib/backend/types";
import { WikiLinks } from "./wikiLinks";

function isAttachableFile(file: File): boolean {
  return file.type.startsWith("image/") || file.type.startsWith("audio/");
}

// Deliberately short lists: pick a color, not a color picker.
const TEXT_COLORS = [
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Green", value: "#16a34a" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Purple", value: "#a855f7" },
];

// Translucent, so a highlight stays readable on both the light and dark
// theme instead of needing a variant for each.
const HIGHLIGHT_COLORS = [
  { name: "Yellow", value: "rgba(250, 204, 21, 0.45)" },
  { name: "Green", value: "rgba(74, 222, 128, 0.4)" },
  { name: "Blue", value: "rgba(96, 165, 250, 0.4)" },
  { name: "Pink", value: "rgba(244, 114, 182, 0.4)" },
];

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 30, 36, 48];
const DEFAULT_FONT_SIZE = 16;

function currentSize(editor: Editor): number {
  const raw = editor.getAttributes("textStyle").fontSize as string | undefined;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : DEFAULT_FONT_SIZE;
}

function stepSize(editor: Editor, direction: 1 | -1) {
  const size = currentSize(editor);
  const next =
    direction === 1
      ? FONT_SIZES.find((s) => s > size)
      : [...FONT_SIZES].reverse().find((s) => s < size);
  if (next === undefined) return;
  if (next === DEFAULT_FONT_SIZE) editor.chain().focus().unsetFontSize().run();
  else editor.chain().focus().setFontSize(`${next}px`).run();
}

// Buttons in the popup use onMouseDown + preventDefault so pressing one
// never steals focus from the editor — which would collapse the very
// selection the button is about to act on.
function MenuButton({
  label,
  active,
  onPress,
  children,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => {
        e.preventDefault();
        onPress();
      }}
      className={`flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-sm transition-colors hover:bg-accent ${
        active ? "bg-accent text-primary" : "text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden="true" />;
}

function Swatch({
  label,
  color,
  active,
  onPress,
}: {
  label: string;
  color: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => {
        e.preventDefault();
        onPress();
      }}
      className={`h-5 w-5 shrink-0 rounded-full border transition-transform hover:scale-110 ${
        active ? "border-foreground" : "border-border"
      }`}
      style={{ backgroundColor: color }}
    />
  );
}

function SelectionMenu({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      color: (e.getAttributes("textStyle").color as string | undefined) ?? null,
      highlight: (e.getAttributes("highlight").color as string | undefined) ?? null,
    }),
  });

  return (
    <div className="flex max-w-[calc(100vw-1.5rem)] flex-wrap items-center gap-1 rounded-lg border border-border bg-popover p-1 shadow-lg">
      <MenuButton
        label="Bold"
        active={state.bold}
        onPress={() => editor.chain().focus().toggleBold().run()}
      >
        <span className="font-bold">B</span>
      </MenuButton>
      <MenuButton
        label="Italic"
        active={state.italic}
        onPress={() => editor.chain().focus().toggleItalic().run()}
      >
        <span className="italic">I</span>
      </MenuButton>

      <Divider />
      <MenuButton label="Smaller text" onPress={() => stepSize(editor, -1)}>
        <span className="text-xs">A</span>
        <span className="text-[10px]">−</span>
      </MenuButton>
      <MenuButton label="Larger text" onPress={() => stepSize(editor, 1)}>
        <span className="text-base">A</span>
        <span className="text-[10px]">+</span>
      </MenuButton>

      <Divider />
      <div className="flex items-center gap-1 px-0.5" role="group" aria-label="Text color">
        <span className="mr-0.5 text-[11px] text-muted-foreground">Text</span>
        {/* The theme's own text color — black on light, white on dark — and
            what picking it does is clear the color, so text goes back to
            following the theme. */}
        <Swatch
          label="Default text color"
          color="var(--foreground)"
          active={state.color === null}
          onPress={() => editor.chain().focus().unsetColor().run()}
        />
        {TEXT_COLORS.map((c) => (
          <Swatch
            key={c.value}
            label={`${c.name} text`}
            color={c.value}
            active={state.color === c.value}
            onPress={() => editor.chain().focus().setColor(c.value).run()}
          />
        ))}
      </div>

      <Divider />
      <div className="flex items-center gap-1 px-0.5" role="group" aria-label="Highlight">
        <span className="mr-0.5 text-[11px] text-muted-foreground">Highlight</span>
        {HIGHLIGHT_COLORS.map((c) => (
          <Swatch
            key={c.value}
            label={`${c.name} highlight`}
            color={c.value}
            active={state.highlight === c.value}
            onPress={() =>
              // Pressing the color the selection already has removes it.
              state.highlight === c.value
                ? editor.chain().focus().unsetHighlight().run()
                : editor.chain().focus().setHighlight({ color: c.value }).run()
            }
          />
        ))}
      </div>
    </div>
  );
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
      <circle cx="5.5" cy="6" r="1.1" />
      <path d="M2 12l3.5-3.5a1 1 0 0 1 1.4 0L9 10.5l1.6-1.6a1 1 0 0 1 1.4 0L14 11" />
    </svg>
  );
}

function AudioIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3.5v6.4a1.9 1.9 0 1 0 1 1.67V6h3V4H7a1 1 0 0 0-1 1.5" />
      <circle cx="5" cy="11.5" r="1.8" />
    </svg>
  );
}

// Persistent (not selection-triggered, unlike SelectionMenu) so it's
// there whether or not anything's selected — inserting an attachment
// isn't an act on existing text.
function AttachmentToolbar({ editor }: { editor: Editor }) {
  const { backend } = useBackend();
  const [busy, setBusy] = useState<"image" | "audio" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined, kind: "image" | "audio") {
    if (!file || !backend) return;
    setError(null);
    setBusy(kind);
    await insertFilesAt(editor.view, backend, [file], editor.state.selection.from, setError);
    setBusy(null);
    editor.commands.focus();
  }

  return (
    <div className="mb-2 flex items-center gap-1">
      <button
        type="button"
        onClick={() => imageInput.current?.click()}
        disabled={busy !== null}
        title="Insert image"
        className="flex h-7 items-center gap-1.5 rounded px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60"
      >
        <ImageIcon />
        {busy === "image" ? "Uploading…" : "Image"}
      </button>
      <button
        type="button"
        onClick={() => audioInput.current?.click()}
        disabled={busy !== null}
        title="Insert audio"
        className="flex h-7 items-center gap-1.5 rounded px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60"
      >
        <AudioIcon />
        {busy === "audio" ? "Uploading…" : "Audio"}
      </button>
      {error && <span className="text-xs text-destructive">{error}</span>}
      <input
        ref={imageInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0], "image");
          e.target.value = "";
        }}
      />
      <input
        ref={audioInput}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0], "audio");
          e.target.value = "";
        }}
      />
    </div>
  );
}

// A Markdown-flavoured rich text editor: type `# `, `- `, `1. `, `> `,
// `[ ] `, `**bold**`, `_italic_`, `` `code` `` or `---` and it converts as
// you type. Selecting text pops up a small bar for size, color and
// highlight — nothing else to configure. Content is stored as HTML.
export function NoteEditor({
  initialContent,
  onChange,
  focusStartRef,
  autoFocus,
  onOpenLink,
}: {
  initialContent: string;
  onChange: (html: string) => void;
  // Called with the title inside a [[link]] that was Ctrl/Cmd+clicked.
  onOpenLink?: (title: string) => void;
  // Lets the title field above hand focus down into the body on Enter.
  focusStartRef?: MutableRefObject<(() => void) | null>;
  autoFocus?: boolean;
}) {
  const { backend } = useBackend();
  const [dropError, setDropError] = useState<string | null>(null);

  // handleDrop/handlePaste below close over `backend` at editor-creation
  // time — kept current across a backend switch via a ref (updated in an
  // effect, not during render, so it doesn't run afoul of concurrent
  // rendering discarding an in-progress render), since useEditor isn't
  // recreated just because this component re-renders.
  const backendRef = useRef<Backend | null>(backend);
  useEffect(() => {
    backendRef.current = backend;
  }, [backend]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TextStyle,
      Color,
      FontSize,
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: "Write here or jot down something interesting…" }),
      AttachmentImage,
      AttachmentAudio,
      LinkPreviewNode,
      LinkPreviewPaste,
      WikiLinks,
    ],
    content: initialContent,
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        class:
          "prose prose-slate max-w-none min-h-[50vh] pb-24 text-[16px] outline-none dark:prose-invert",
      },
      // `moved` is true for dragging existing editor content around
      // (reordering a paragraph, say) — only an drag arriving from
      // outside (the OS file picker, another app) carries files.
      handleDrop(view, event, _slice, moved) {
        const backend = backendRef.current;
        const files = Array.from(event.dataTransfer?.files ?? []).filter(isAttachableFile);
        if (moved || files.length === 0 || !backend) return false;
        event.preventDefault();
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        void insertFilesAt(view, backend, files, coords?.pos ?? view.state.selection.from, setDropError);
        return true;
      },
      // Pasting an actual file (a screenshot, a copied image) rather than
      // a link — LinkPreviewPaste handles the "pasted a bare URL" case
      // separately, since that's text, not a file.
      handlePaste(view, event) {
        const backend = backendRef.current;
        const files = Array.from(event.clipboardData?.files ?? []).filter(isAttachableFile);
        if (files.length === 0 || !backend) return false;
        event.preventDefault();
        void insertFilesAt(view, backend, files, view.state.selection.from, setDropError);
        return true;
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? "" : e.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    editor.commands.setWikiLinkHandler(onOpenLink ?? null);
  }, [editor, onOpenLink]);

  useEffect(() => {
    if (!editor || !focusStartRef) return;
    focusStartRef.current = () => editor.commands.focus("start");
    return () => {
      focusStartRef.current = null;
    };
  }, [editor, focusStartRef]);

  if (!editor) return null;

  return (
    <>
      <AttachmentToolbar editor={editor} />
      {dropError && <p className="-mt-1 mb-2 text-xs text-destructive">{dropError}</p>}
      <BubbleMenu editor={editor} options={{ placement: "top", offset: 8 }}>
        <SelectionMenu editor={editor} />
      </BubbleMenu>
      <EditorContent editor={editor} />
    </>
  );
}
