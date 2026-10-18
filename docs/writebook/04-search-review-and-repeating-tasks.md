---
title: Search, Review & Repeating Tasks
---
# Search, Review & Repeating Tasks

## TL;DR

- **Ctrl/⌘ + K** searches tracks, topics, tasks and notes at once.
- **Review** shows what slipped (with one-tap fixes), what's gone quiet and
  what's coming up.
- Tasks can repeat daily, on weekdays, weekly or monthly; ticking one off
  creates the next.
- Rate a topic **Shaky / Okay / Solid**; with **Remind me to revisit finished topics** on (Settings →
  Learning), finished topics come back as review tasks.
- **Export** a track as Markdown, or download and restore a full **.json**
  backup from Settings.

Once a few tracks are filled in, the questions change from "what do I write
down?" to "where did I put that?" and "am I actually making progress?".

## Search

Press **Ctrl + K** (⌘ + K on a Mac) anywhere, or pick **Search** in the
sidebar. It looks through track names, topic titles, task titles and the text
of your notes at once. Every word you type has to match, ignoring case and
accents, and open tasks rank above finished ones. Clicking a task or topic
opens its track with that topic already expanded.

## Review

**Review** is a check on what needs sorting out. Today links to it when tasks
have slipped. There are no streaks or activity grid on purpose: counting days
turns a quiet week into a debt. The trail on each track is the look back.

- **Done in the last 7 days**, next to the week before it, and focus time.
- **Slipped.** Overdue tasks that are still open. A pile of these is the
  quickest way to stop wanting to open a to-do list, so there are two ways to
  clear it in one move: **Move all to today**, or **Clear deadlines** (the
  tasks stay, they just stop being overdue).
- **Shaky** and **Finished but unrated**, when spaced revisit is on. See
  "Rating a topic" below.
- **Gone quiet.** Topics you started but haven't finished a task in for 14+
  days, and tracks with open work and nothing done in that time. Paused and
  archived tracks are left out on purpose.
- **Coming up** in the next 7 days, and everything **finished this week**.

History starts from when you tick things: tasks finished before this existed
count only from the moment they were stored as done.

## Repeating tasks

When adding or editing a task, the **Repeat** menu offers every day, every
weekday, every week or every month. Tick the task off and the next one is
created straight away, so a repeating task is always a single open item.

- The next date keeps the task's own rhythm (a weekly Monday task stays on
  Mondays), but never lands in the past, so finishing something a month late
  doesn't leave a pile of overdue copies.
- A task with no deadline repeats from today.
- Stop repeating by editing the open task and choosing "Doesn't repeat".
- A repeating mark (↻) shows next to it on Today and on the track page.

In Markdown, add `#repeat:daily`, `#repeat:weekdays`, `#repeat:weekly` or
`#repeat:monthly` next to `#priority:` and `#due:`.

## Rating a topic

Ticking everything off says you did it, not that it stuck. With spaced revisit
on (below), each topic has a small **Rate** chip: click it to cycle **Shaky → Okay → Solid → unrated**. It's
your own call, not a quiz.

- A topic rated **shaky** comes back sooner (reviews at 1, 3 and 7 days);
  **solid** later (7 and 30 days). Unrated uses the middle schedule.
- Rating a finished topic shaky books its reviews straight away.
- **Review** lists your shaky topics, and finished ones you haven't rated.

## Spaced revisit

Off unless you turn it on, as **Remind me to revisit finished topics** in
**Settings → Learning**, because tasks the app
adds by itself crowd out the ones you chose. When it's on, finishing every task
in a topic adds review tasks to that track, due 3, 7 and
21 days later by default, e.g. "Review: Pointers (day 7)". They live in a
**Reviews** topic that's created for you. At most 12 reviews stay open on a
track; past that, new ones wait until you've cleared some, so finishing a big
roadmap doesn't bury you. The choice is saved on the device you set it on.

Quick-added tasks never get reviews: finishing what's in the **Inbox**, or in
the **Tasks** topic quick add makes in a track with no topics, is an errand
done, not something to revisit.

## Reordering and export

- **Move up / Move down** in a task's ⋮ menu changes its order within the topic.
- **Export** on a track's page downloads it as Markdown, in exactly the format
  **Paste a plan** reads, so it round-trips.
- **Settings → Your data → Download .json** saves everything (tracks, topics,
  tasks, notes, ratings, the lines on your trails) as one backup file. Images and audio embedded in
  notes aren't part of it.
- **Settings → Your data → Choose file…** restores a backup. It always *adds*
  the contents as new tracks and notes; nothing you already have is changed or
  replaced, so restoring into an account that already holds the same data
  gives you a second copy. You see the counts and confirm first.
