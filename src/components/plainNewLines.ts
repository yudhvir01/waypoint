import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

const key = new PluginKey("plainNewLines");

// Pressing Enter at the end of coloured, highlighted, bold or resized text
// would normally carry that formatting onto the new line. Here a new line
// starts plain; the formatting stays on the text that already has it.
//
// Splitting a line carries formatting by setting "stored marks" for the
// next thing typed, so: when an edit leaves the cursor on an empty line
// with stored marks it set, those are cleared. Choosing a colour on an
// empty line sets stored marks without editing the note, so that still
// works.
export const PlainNewLines = Extension.create({
  name: "plainNewLines",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key,
        appendTransaction(transactions, _old, state) {
          const { selection, storedMarks } = state;
          if (!storedMarks?.length || !selection.empty || selection.$from.parent.content.size > 0) return null;
          if (!transactions.some((tr) => tr.docChanged && tr.storedMarksSet)) return null;
          return state.tr.setStoredMarks([]);
        },
      }),
    ];
  },
});
