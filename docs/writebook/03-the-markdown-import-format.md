---
title: The Markdown Import Format
---
# The Markdown Import Format

Instead of clicking through the UI to build out a whole track by hand, you can
write it as a plain Markdown file and import it in one go — useful if you're
bringing in an existing Obsidian note, or you just think better in a text editor.

## The shape

```markdown
# Track Name
Optional free-text description line(s) before the first ## become the track description.

## Topic Title
- [ ] Task text #priority:high #due:2026-09-10
- [x] Completed task (already done)
- [ ] Task with no tags (defaults: priority=none, due=none)

## Another Topic
- [ ] ...
```

## The rules

- **One `#` heading, at the top.** That's the track name. Required.
- **Every `##` heading is a topic.** You need at least one.
- **Every `- [ ]` or `- [x]` line under a topic is a task.** `[x]` means it's
  already done.
- **Inline tags on a task line** are optional and stripped from the displayed
  title:
  - `#priority:low`, `#priority:medium`, or `#priority:high`
  - `#due:YYYY-MM-DD`
- Anything that doesn't match one of the rules above (a stray tag, a malformed
  date) doesn't fail the import — it shows up as a warning on the preview screen
  before anything is saved, so you can fix it or import anyway.

## A worked example

```markdown
# Modern C++
Getting comfortable with C++ as a daily language, not just for interviews.

## Smart Pointers
- [x] Read about unique_ptr
- [ ] Read about shared_ptr and weak_ptr #priority:medium
- [ ] Rewrite an old raw-pointer project using RAII #priority:high #due:2026-09-20

## Move Semantics
- [ ] Understand rvalue references
- [ ] Implement a move constructor and move assignment operator #priority:medium
```

This creates one track ("Modern C++"), two topics ("Smart Pointers", "Move
Semantics"), and five tasks — one already marked done, two with priorities, one
with a due date.

## Importing

From the dashboard, choose **New Track → Import from Markdown**, paste the file
(or upload it), and review the preview — it shows exactly what will be created,
plus any warnings — before you confirm.
