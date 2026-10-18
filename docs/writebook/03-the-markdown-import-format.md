---
title: The Markdown Import Format
---
# The Markdown Import Format

## TL;DR

- Write a whole track as Markdown and import it in one go: **+ Add track →
  Paste a plan**.
- `#` is the track, any heading with list items under it is a topic, and every
  bullet is a task (`- [x]` means already done).
- Tag tasks with `#priority:high`, `#due:2026-09-10` and `#repeat:weekly`.
- No file yet? **Copy AI prompt** in the import box and paste it into any AI
  chat. It asks a few questions (goal, deadline, time, habits), then writes a
  track you paste straight back, chat and all.
- You always see a preview with warnings before anything is created.

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
  - `#repeat:daily`, `#repeat:weekdays`, `#repeat:weekly`, or `#repeat:monthly`
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

## Let an AI write it

You don't have to write this format by hand. In the import box, tap **Copy AI
prompt** and paste it into ChatGPT, Claude, Gemini or any other AI chat, with
your notes, a syllabus, or just the thing you want to learn.

The AI first asks you a few short questions, each one feeding a part of
Waypoint:

| It asks | It becomes |
| --- | --- |
| What's the goal, and what does done look like? | the track name and its **Headed to** sentence |
| What do you already know or have done? | tasks marked done, or left out |
| Is there a deadline? Dates leading up to it? | `#due:` dates, paced to your time |
| How much time do you have per day or week? | task size and spacing |
| Anything you want to do regularly? | `#repeat:` tasks |
| What matters most? | `#priority:` tags |

Answer what you like, or say "skip". It then writes the track in a code block
with a copy button. Copy it, or the whole reply, into the import box: Waypoint
takes the track out of the code block and ignores the chat around it. Several
goals come back as several blocks; import them one at a time.

The prompt carries today's date, so deadlines come out as real dates. Copy a
fresh one each time rather than reusing an old copy.

## Importing

From the dashboard, choose **+ Add track → Paste a plan**, paste the file,
and review the preview — it shows exactly what will be created, plus any
warnings — before you confirm.

Very long names are shortened to fit (a track name to 200 characters, a topic to
500, a task to 1,000), with a warning on the preview, so nothing fails to
import because a line ran on.
