---
title: Search, Review & Repeating Tasks
---
# Search, Review & Repeating Tasks

## TL;DR

- **Ctrl/⌘ + K** searches tracks, topics, tasks, notes and day lines at once.
- **Review** shows what slipped (with one-tap fixes), what's gone quiet and
  what's coming up.
- Tasks can repeat daily, on weekdays, weekly or monthly; ticking one off
  creates the next.
- **Review later…** on any task adds a "Review:" task due in 1, 3, 7, 21 or
  30 days, or on a date you pick.
- A missed deadline says **Deadline crossed · N days ago**.
- **Export** a track as Markdown, or download and restore a full **.json**
  backup from Settings.

Once a few tracks are filled in, the questions change from "what do I write
down?" to "where did I put that?" and "am I actually making progress?".

## Search

Press **Ctrl + K** (⌘ + K on a Mac) anywhere, or pick **Search** in the
sidebar. It looks through track names, topic titles, task titles, the text
of your notes and the lines you wrote when closing each day, all at once. Every word you type has to match, ignoring case and
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

## Reviewing a task later

When you want to go over something again, open the task (tap it on Today)
and choose **Review later…**, or pick **Review later…** in its ⋮ menu on the
track page. Choose **1, 3, 7, 21 or 30 days**, or a date of your own.

That adds a task called "Review: *the task's name*" to the same topic, due on
that day. The task you started from isn't changed. The review stays off
Today's suggestions until its day, then shows up like any other task due
today. Setting a review for the same task again moves the waiting one to the
new day instead of adding a second.

Waypoint never adds reviews by itself: you decide what's worth revisiting,
and when.

## Deadlines

A task's deadline reads as **Due today**, **Due tomorrow**, **Due in 3 days**
or a date. Once it has passed and the task is still open, it says **Deadline
crossed · 4 days ago** in red, on Today, on the track page, in the task's
details and in **Review your week**.

## Reordering and export

- **Drag a task** to change its order within its topic: on a phone, hold it
  for a moment until it lifts, then move it; in a browser, click and drag.
  A quick swipe still just scrolls. **Move up / Move down** in the task's ⋮
  menu do the same one step at a time, and **Move to…** puts it in another
  topic or track.
- **Export** on a track's page downloads it as Markdown, in exactly the format
  **Paste a plan** reads, so it round-trips.
- **Settings → Your data → Download .json** saves everything (tracks, topics,
  tasks, notes, ratings, the lines on your trails) as one backup file. Images and audio embedded in
  notes aren't part of it.
- **Settings → Your data → Choose file…** restores a backup. It always *adds*
  the contents as new tracks and notes; nothing you already have is changed or
  replaced, so restoring into an account that already holds the same data
  gives you a second copy. You see the counts and confirm first.
