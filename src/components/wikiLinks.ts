import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { WIKI_LINK_SOURCE } from "../lib/links";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    wikiLinks: {
      // Tells the editor what to do when a [[link]] is opened.
      setWikiLinkHandler: (handler: ((title: string) => void) | null) => ReturnType;
    };
  }
}

const key = new PluginKey("wikiLinks");

// Shows [[Title]] as a link, and opens it on Ctrl/Cmd+click. A plain
// click still just puts the cursor there, so the link text stays
// editable; the Links list under the note is the tap-friendly route.
export const WikiLinks = Extension.create<Record<string, never>, { onOpen: ((title: string) => void) | null }>({
  name: "wikiLinks",

  // The handler lives in the editor's storage so the page can swap it for
  // a fresh one on every render without rebuilding the editor.
  addStorage() {
    return { onOpen: null };
  },

  addCommands() {
    const storage = this.storage;
    return {
      setWikiLinkHandler:
        (handler) =>
        () => {
          storage.onOpen = handler;
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const storage = this.storage;
    return [
      new Plugin({
        key,
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return;
              for (const m of node.text.matchAll(new RegExp(WIKI_LINK_SOURCE, "g"))) {
                const from = pos + (m.index ?? 0);
                decorations.push(Decoration.inline(from, from + m[0].length, { class: "wiki-link" }));
              }
            });
            return DecorationSet.create(state.doc, decorations);
          },
          handleClick(view, pos, event) {
            if (!(event.ctrlKey || event.metaKey)) return false;
            const $pos = view.state.doc.resolve(pos);
            const text = $pos.parent.textContent;
            const offset = $pos.parentOffset;
            for (const m of text.matchAll(new RegExp(WIKI_LINK_SOURCE, "g"))) {
              const start = m.index ?? 0;
              if (offset >= start && offset <= start + m[0].length) {
                event.preventDefault();
                storage.onOpen?.(m[1].trim());
                return true;
              }
            }
            return false;
          },
        },
      }),
    ];
  },
});
