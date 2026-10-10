---
title: Linking Notes
---
# Linking Notes

Write a name in double square brackets and it becomes a link:

```
Pointers are easier once [[RAII]] clicks.
```

The text is highlighted in the note. **Ctrl/Cmd + click** it to open the
target. A plain click only places the cursor, so you can still edit the
link text.

## What a link can point at

The name is matched ignoring case and accents, in this order:

1. a **note** with that title (the most recently edited, if there are several)
2. a **task** with that title (an open one first), which opens that task's
   note, created on the spot if it has none yet
3. a **topic**, which opens its track with the topic expanded
4. a **track**

A link to nothing yet becomes a note of that name when you open it, so you can
write links first and fill the notes in later.

`[[Title|shown text]]` is accepted too; only the part before the bar is the
target.

## Under the note

Below a note, two lists appear once there's anything to show:

- **Links**: everything this note points at. Each is a tap-friendly link, with
  what it resolved to. Ones that point at nothing have a **Create note** button.
- **Linked from**: the other notes that mention this note's title in a
  `[[link]]`, newest first, each with the sentence around the link. This is
  how you find what builds on a note without having to remember it.

Rename a note and its backlinks follow its new title, because links are by
name: old `[[links]]` to the previous title stop matching until you update
them.
