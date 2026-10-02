import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Extension, Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { useBackend } from "../context/BackendProvider";
import { fetchLinkPreview, soleUrl } from "../lib/linkPreview";
import { LINK_PREVIEW_URL } from "../lib/env";
import type { AttachmentKind, Backend } from "../lib/backend/types";

// Self-imposed — none of the three backends enforce this uniformly
// (Supabase's bucket does via setup.sql, guest/Drive don't), so it's
// checked here instead to give the same "too big" message everywhere,
// regardless of whether the file came in through the toolbar, a paste,
// or a drop.
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

// Shared by the toolbar's file pickers, drag-and-drop, and pasting a
// file (as opposed to pasting a link, see LinkPreviewPaste) — uploads
// each file in turn and inserts it as a node right after the last one,
// so dropping/pasting several files at once lands them in order instead
// of racing to the same position.
export async function insertFilesAt(
  view: EditorView,
  backend: Backend,
  files: File[],
  pos: number,
  onError: (message: string) => void,
): Promise<void> {
  let insertPos = pos;
  for (const file of files) {
    const kind: AttachmentKind = file.type.startsWith("audio/") ? "audio" : "image";
    if (file.size > MAX_ATTACHMENT_BYTES) {
      onError(`"${file.name}" is over 25 MB and was skipped.`);
      continue;
    }
    try {
      const attachment = await backend.uploadAttachment(file, kind);
      const nodeType = view.state.schema.nodes[kind === "image" ? "attachmentImage" : "attachmentAudio"];
      const node = nodeType.create({ attachmentId: attachment.id, name: attachment.name });
      view.dispatch(view.state.tr.insert(insertPos, node));
      insertPos += node.nodeSize;
    } catch {
      onError(`Couldn't upload "${file.name}" — try again.`);
    }
  }
}

function RemoveButton({ onRemove, label }: { onRemove: () => void; label: string }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onRemove();
      }}
      aria-label={label}
      title={label}
      className="absolute right-1.5 top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white group-hover:flex"
    >
      <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
      </svg>
    </button>
  );
}

// Resolves the backend-specific attachment id into something an <img>/
// <audio> tag can load — a public URL, an object URL, whatever the
// active backend hands back (see Backend.resolveAttachmentUrl). Re-run
// whenever the id changes, which in practice is never for a given node —
// attachments aren't editable in place, only inserted or removed.
function useAttachmentUrl(id: string | null): { url: string | null; error: boolean } {
  const { backend } = useBackend();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setUrl(null);
    setError(false);
    if (!backend || !id) return;
    let cancelled = false;
    backend
      .resolveAttachmentUrl(id)
      .then((resolved) => {
        if (!cancelled) setUrl(resolved);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [backend, id]);

  return { url, error };
}

const MIN_IMAGE_WIDTH = 80;

// Bottom-right drag handle, à la Google Docs/Notion. Drags update a local
// "live" width for a smooth resize, and only commit to the node's stored
// `width` attribute (and so to the saved note) on release — otherwise
// every pixel of mouse movement would fire a save.
function ImageAttachmentView({ node, deleteNode, updateAttributes }: NodeViewProps) {
  const id = node.attrs.attachmentId as string | null;
  const { url, error } = useAttachmentUrl(id);
  const storedWidth = node.attrs.width as string | null;
  const [liveWidth, setLiveWidth] = useState<number | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  function startResize(e: ReactPointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const img = imgRef.current;
    if (!img) return;
    const startX = e.clientX;
    const startWidth = img.getBoundingClientRect().width;
    const container = img.closest(".ProseMirror") as HTMLElement | null;
    const maxWidth = container ? container.getBoundingClientRect().width : startWidth * 3;

    function widthAt(clientX: number): number {
      return Math.round(Math.min(maxWidth, Math.max(MIN_IMAGE_WIDTH, startWidth + (clientX - startX))));
    }
    function onMove(ev: PointerEvent) {
      setLiveWidth(widthAt(ev.clientX));
    }
    function onUp(ev: PointerEvent) {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setLiveWidth(null);
      updateAttributes({ width: `${widthAt(ev.clientX)}px` });
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // Two-finger pinch on touch screens, where the hover-only drag handle
  // above never shows. touch-action on the <img> (below) opts it out of
  // the browser's own page-zoom gesture so these events arrive intact,
  // while one-finger scrolling still works.
  const updateRef = useRef(updateAttributes);
  useEffect(() => {
    updateRef.current = updateAttributes;
  }, [updateAttributes]);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    let startDist = 0;
    let startWidth = 0;
    let maxWidth = 0;
    let current = 0;

    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    function onStart(e: TouchEvent) {
      if (e.touches.length !== 2 || !img) return;
      startDist = dist(e.touches);
      startWidth = img.getBoundingClientRect().width;
      const container = img.closest(".ProseMirror") as HTMLElement | null;
      maxWidth = container ? container.getBoundingClientRect().width : startWidth * 3;
      current = startWidth;
    }
    function onMove(e: TouchEvent) {
      if (e.touches.length !== 2 || !startDist) return;
      e.preventDefault();
      current = Math.round(Math.min(maxWidth, Math.max(MIN_IMAGE_WIDTH, (startWidth * dist(e.touches)) / startDist)));
      setLiveWidth(current);
    }
    function onEnd(e: TouchEvent) {
      if (!startDist || e.touches.length >= 2) return;
      startDist = 0;
      setLiveWidth(null);
      updateRef.current({ width: `${current}px` });
    }

    img.addEventListener("touchstart", onStart, { passive: true });
    img.addEventListener("touchmove", onMove, { passive: false });
    img.addEventListener("touchend", onEnd);
    img.addEventListener("touchcancel", onEnd);
    return () => {
      img.removeEventListener("touchstart", onStart);
      img.removeEventListener("touchmove", onMove);
      img.removeEventListener("touchend", onEnd);
      img.removeEventListener("touchcancel", onEnd);
    };
  }, [url]);

  const width = liveWidth ? `${liveWidth}px` : storedWidth;

  return (
    <NodeViewWrapper className="group relative my-2 inline-block max-w-full" data-drag-handle>
      {error ? (
        <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-4 py-8 text-xs text-muted-foreground">
          Couldn't load this image.
        </div>
      ) : !url ? (
        <div className="flex h-32 w-48 animate-pulse items-center justify-center rounded-md border border-border bg-muted text-xs text-muted-foreground">
          Loading…
        </div>
      ) : (
        <>
          <img
            ref={imgRef}
            src={url}
            alt={(node.attrs.name as string | null) ?? ""}
            style={{ touchAction: "pan-x pan-y", ...(width ? { width, maxWidth: liveWidth ? "none" : "100%" } : {}) }}
            className={`rounded-md border border-border ${width ? "" : "max-h-[70vh] max-w-full"}`}
          />
          <span
            onPointerDown={startResize}
            aria-hidden="true"
            className="absolute bottom-1 right-1 h-3.5 w-3.5 cursor-nwse-resize rounded-sm border border-white/70 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
          />
        </>
      )}
      <RemoveButton onRemove={() => deleteNode()} label="Remove image" />
    </NodeViewWrapper>
  );
}

function AudioAttachmentView({ node, deleteNode }: NodeViewProps) {
  const id = node.attrs.attachmentId as string | null;
  const { url, error } = useAttachmentUrl(id);
  const name = (node.attrs.name as string | null) ?? "Audio clip";

  return (
    <NodeViewWrapper className="group relative my-2 block" data-drag-handle>
      <div className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5">
        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{name}</span>
        {error ? (
          <span className="text-xs text-destructive">Couldn't load this clip.</span>
        ) : !url ? (
          <span className="text-xs text-muted-foreground">Loading…</span>
        ) : (
          // eslint-disable-next-line jsx-a11y/media-has-caption -- a personal voice clip has no track to caption
          <audio controls src={url} className="h-8 max-w-full" />
        )}
      </div>
      <RemoveButton onRemove={() => deleteNode()} label="Remove audio" />
    </NodeViewWrapper>
  );
}

function LinkPreviewView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const { supabaseConfig } = useBackend();
  const url = node.attrs.url as string;
  const title = node.attrs.title as string | null;
  const description = node.attrs.description as string | null;
  const image = node.attrs.image as string | null;
  const siteName = node.attrs.siteName as string | null;
  const resolved = node.attrs.resolved as boolean;
  const [imageFailed, setImageFailed] = useState(false);

  // LINK_PREVIEW_URL (a deployer-configured relay, or the baked-in
  // default project's own function) works regardless of which backend
  // this person is on — guest and Google Drive have no "connected
  // Supabase project" of their own to fall back to otherwise. Only when
  // neither of those is configured does a Supabase-mode user's own
  // connected project get tried, which is the one case where deploying
  // the function to just your own project is enough.
  const endpoint = LINK_PREVIEW_URL ?? (supabaseConfig ? `${supabaseConfig.url.replace(/\/$/, "")}/functions/v1/link-preview` : null);

  useEffect(() => {
    if (resolved || !endpoint) return;
    let cancelled = false;
    fetchLinkPreview(endpoint, url)
      .then((data) => {
        if (cancelled) return;
        updateAttributes({
          title: data.title,
          description: data.description,
          image: data.image,
          siteName: data.siteName,
          resolved: true,
        });
      })
      .catch(() => {
        if (!cancelled) updateAttributes({ resolved: true });
      });
    return () => {
      cancelled = true;
    };
    // Only the url this node was created with, and whether it's already
    // been resolved, should ever re-trigger this — the endpoint changing
    // mid-session (switching Supabase projects) shouldn't re-fetch every
    // preview already showing on screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, resolved]);

  const loading = !resolved && !!endpoint;
  let hostname = siteName ?? "";
  if (!hostname) {
    try {
      hostname = new URL(url).hostname;
    } catch {
      hostname = url;
    }
  }

  return (
    <NodeViewWrapper className="group relative my-2 block" data-drag-handle>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="not-prose flex overflow-hidden rounded-md border border-border bg-card no-underline transition-colors hover:border-primary"
      >
        {image && !imageFailed && (
          <img src={image} alt="" onError={() => setImageFailed(true)} className="h-24 w-24 shrink-0 object-cover" />
        )}
        <div className="min-w-0 flex-1 px-3 py-2">
          <p className="truncate text-xs text-muted-foreground">{hostname}</p>
          <p className="mt-0.5 truncate text-sm font-medium text-foreground">
            {loading ? "Fetching preview…" : title || url}
          </p>
          {description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{description}</p>}
        </div>
      </a>
      <RemoveButton onRemove={() => deleteNode()} label="Remove link preview" />
    </NodeViewWrapper>
  );
}

// Block atom nodes: not directly editable text, just a chunk the editor
// treats as one unit for cursor movement, selection, and delete. Each
// stores just enough in data-* attributes to survive a save/reload round
// trip through the note's stored HTML.
export const AttachmentImage = Node.create({
  name: "attachmentImage",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      attachmentId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-attachment-id"),
        renderHTML: (attrs) => ({ "data-attachment-id": attrs.attachmentId }),
      },
      name: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-name"),
        renderHTML: (attrs) => ({ "data-name": attrs.name }),
      },
      // Set once someone drags the resize handle; a CSS px value. Unset
      // means "however big the image naturally renders", capped by the
      // max-height/max-width the node view's className applies.
      width: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-width"),
        renderHTML: (attrs) => (attrs.width ? { "data-width": attrs.width } : {}),
      },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-attachment-image]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-attachment-image": "" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageAttachmentView);
  },
});

export const AttachmentAudio = Node.create({
  name: "attachmentAudio",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      attachmentId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-attachment-id"),
        renderHTML: (attrs) => ({ "data-attachment-id": attrs.attachmentId }),
      },
      name: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-name"),
        renderHTML: (attrs) => ({ "data-name": attrs.name }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-attachment-audio]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-attachment-audio": "" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(AudioAttachmentView);
  },
});

export const LinkPreviewNode = Node.create({
  name: "linkPreview",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      url: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-url"),
        renderHTML: (attrs) => ({ "data-url": attrs.url }),
      },
      title: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-title"),
        renderHTML: (attrs) => ({ "data-title": attrs.title }),
      },
      description: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-description"),
        renderHTML: (attrs) => ({ "data-description": attrs.description }),
      },
      image: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-image"),
        renderHTML: (attrs) => ({ "data-image": attrs.image }),
      },
      siteName: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-site-name"),
        renderHTML: (attrs) => ({ "data-site-name": attrs.siteName }),
      },
      // Whether a fetch (successful or not) has already happened for this
      // node — without this, reloading a note with no Supabase project
      // configured would show "Fetching preview…" forever instead of
      // falling back to the plain link.
      resolved: {
        default: false,
        parseHTML: (el) => el.getAttribute("data-resolved") === "true",
        renderHTML: (attrs) => ({ "data-resolved": attrs.resolved ? "true" : "false" }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-link-preview]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-link-preview": "" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(LinkPreviewView);
  },
});

// Pasting a link on its own (nothing else in the clipboard, no styled
// text alongside it) swaps the plain URL for a preview card — the same
// paste experience Signal and most chat apps give a link. A rich paste
// that already contains an anchor tag (copying a hyperlink from a page,
// not just its address) is left alone so an intentional inline link
// isn't clobbered.
export const LinkPreviewPaste = Extension.create({
  name: "linkPreviewPaste",
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey("linkPreviewPaste"),
        props: {
          handlePaste(_view, event) {
            const text = event.clipboardData?.getData("text/plain") ?? "";
            const url = soleUrl(text);
            if (!url) return false;
            const html = event.clipboardData?.getData("text/html") ?? "";
            if (/<a\s/i.test(html)) return false;
            event.preventDefault();
            editor.commands.insertContent({ type: "linkPreview", attrs: { url } });
            return true;
          },
        },
      }),
    ];
  },
});
