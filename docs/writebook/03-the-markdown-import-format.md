---
title: The Markdown Import Format
---
# The Markdown Import Format

Instead of clicking through the UI to build out a whole track by hand, you can
write it as a plain Markdown file and import it in one go — useful if you're
bringing in an existing Obsidian note, or you just think better in a text editor.

The importer is intentionally simple, but it's built to survive a real,
messy roadmap file — nested headings, plain bullet lists, code blocks, the
works — not just a clean toy example.

## The basic shape

```markdown
# Track Name
Optional free-text description line(s) before the first heading with list
items under it become the track description.

## Topic Title
- [ ] Task text #priority:high #due:2026-09-10
- [x] Completed task (already done)
- Task with no checkbox also works, and starts as not done
```

## The rules

- **The first `#` heading is the track name.** Required, and it must come
  first.
- **Any heading below that — `##`, `###`, even deeper — becomes a topic, as
  long as list items appear directly underneath it** before the next
  heading. A heading with no list items under it (like a plain "Objective"
  or "Goal" sub-heading with just a sentence of prose) is skipped rather
  than turned into an empty topic.
- **Both checkbox and plain bullets become tasks:** `- [ ] text`, `- [x] text`
  (already done), or just `- text` (imported as not done). `*` and `+` work
  as bullet markers too.
- **Inline tags on a task line** are optional and stripped from the displayed
  title:
  - `#priority:low`, `#priority:medium`, or `#priority:high`
  - `#due:YYYY-MM-DD`
- **Duplicate topic names are disambiguated automatically.** If your file
  reuses a heading like "Tech Stack" or "Features" under several different
  top-level sections, Waypoint tags each one with its nearest top-level
  heading (e.g. "Tech Stack (Project 1 - ...)") — but only when there's an
  actual collision, so a normal file's topic names are never touched.
- **Code blocks (` ``` `), horizontal rules (`---`), and blockquotes (`>`)
  are skipped**, not warned about — they're formatting, not tasks.
- Anything else that doesn't match a rule — a stray tag, a malformed date, a
  paragraph of explanatory text with nothing to attach it to — doesn't fail
  the import. It's rolled up into a short warning count on the preview
  screen (e.g. "34 lines of explanatory text weren't recognized as tasks —
  skipped") rather than one line per occurrence, so a 500-line file doesn't
  bury you in 100 individual warnings.

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

### A messier, real-world example

This also works fine on something far less tidy — a multi-phase roadmap with
nested `###` sub-headings, plain (non-checkbox) bullets, ASCII workflow
diagrams in code blocks, and the same "Tech Stack" / "Features" heading
repeated under five different projects:

```markdown
# Forward Deployed AI Engineer Roadmap

# Phase 1: AI Engineering Foundations

## Objective
Build a solid foundation in modern AI engineering.

### Python
- Syntax
- OOP
- Async Programming

### AI Fundamentals
- How LLMs work
- Tokens

# Project 1 - Production AI Customer Support

### Tech Stack
- FastAPI
- PostgreSQL

### Features
- Authentication
- Chat history

# Project 2 - AI Document Search

### Tech Stack
- LangChain
- Vector Database
```

That imports as one track with topics "Python", "AI Fundamentals", "Tech
Stack (Project 1 - Production AI Customer Support)", "Features (Project 1 -
Production AI Customer Support)", "Tech Stack (Project 2 - AI Document
Search)", and so on — the "Objective" heading is skipped (no list items
directly under it), and the duplicate "Tech Stack" / "Features" names are
disambiguated automatically.

## Importing

From the dashboard, choose **+ Add track → Import Markdown**, paste the file,
and review the preview — it shows exactly what will be created, plus any
warnings — before you confirm.
