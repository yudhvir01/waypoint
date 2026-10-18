---
title: Quick Add
---
# Quick Add

## TL;DR

- Press **C** anywhere (or **+ Quick add**) and type one line.
- Dates (`friday`, `in 3 days`), repeats (`every week`), priority (`!high`) and
  a track (`#uni`) are picked out of the text and shown as chips.
- With no track, the task goes to the **Inbox**; move it later with **Move
  to…** in its ⋮ menu.
- Quick-added tasks never get spaced-revisit reviews.

Capturing a thought shouldn't mean choosing a track, a topic, a date and a
priority first. Press **C** anywhere in the app (when you're not typing in a
field), or use **+ Quick add** at the top of the sidebar, and write one line.

## What it understands

| Write | You get |
| --- | --- |
| `tomorrow`, `today`, `next week`, `next month` | a deadline |
| `friday`, `on friday`, `next monday` | the next time that day comes round |
| `in 3 days`, `in 2 weeks` | a deadline that far ahead |
| `oct 15`, `15 oct`, `2026-11-01` | that date (next year if it has passed) |
| `every day`, `daily`, `every weekday`, `every week`, `every month` | a repeating task |
| `every monday` | repeats weekly, starting next Monday |
| `!high` `!medium` `!low` (or `!1` `!2` `!3`) | a priority |
| `#cpp` | put it in the track whose name starts with (or contains) "cpp" |

The same `#priority:high`, `#due:2026-10-20` and `#repeat:weekly` tags the
Markdown import reads work here too.

Whatever it understood is shown as chips under the box before you press
Enter, and is removed from the title. Anything it doesn't understand stays in
the title, so nothing you typed is lost. For example:

```
submit assignment friday !high #uni
```

becomes **"submit assignment"**, due Friday, high priority, in your *Uni*
track.

## The Inbox

With no `#track`, or one that matches nothing, the task goes to an **Inbox**
track that's created the first time you need it. It shows up on Today like
anything else. The box stays open after you add, so you can capture several in
a row; **Esc** closes it.

## Sorting later

On a track's page, a task's ⋮ menu has **Move to…**. Pick a track and a topic
and the task moves to the end of it; both topics' statuses are kept in step,
and the task's note goes with it.
