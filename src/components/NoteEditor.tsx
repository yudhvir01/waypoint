import { useEffect, type MutableRefObject, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { Color, FontSize, TextStyle } from "@tiptap/extension-text-style";
import { TaskItem, TaskList } from "@tiptap/extension-list";

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

// A Markdown-flavoured rich text editor: type `# `, `- `, `1. `, `> `,
// `[ ] `, `**bold**`, `_italic_`, `` `code` `` or `---` and it converts as
// you type. Selecting text pops up a small bar for size, color and
// highlight — nothing else to configure. Content is stored as HTML.
export function NoteEditor({
  initialContent,
  onChange,
  focusStartRef,
  autoFocus,
}: {
  initialContent: string;
  onChange: (html: string) => void;
  // Lets the title field above hand focus down into the body on Enter.
  focusStartRef?: MutableRefObject<(() => void) | null>;
  autoFocus?: boolean;
}) {
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
    ],
    content: initialContent,
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        class:
          "prose prose-slate max-w-none min-h-[50vh] pb-24 text-[16px] outline-none dark:prose-invert",
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? "" : e.getHTML()),
  });

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
      <BubbleMenu editor={editor} options={{ placement: "top", offset: 8 }}>
        <SelectionMenu editor={editor} />
      </BubbleMenu>
      <EditorContent editor={editor} />
    </>
  );
}
