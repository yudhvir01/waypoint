---
title: The Focus Timer
---
# The Focus Timer

A timer for working in blocks, tied to the task you're on.

## Starting one

- On **Focus Now**, press the **▶** at the end of a task row.
- On a track's page, use **Start focus timer** in a task's ⋮ menu.
- Or use **Start focus** in the sidebar for a block that isn't about any
  particular task.

A small timer appears in the bottom-right corner of every page and keeps
running as you move around the app. The tab's title shows the clock too, so
you can see it from another tab.

## What happens

1. **Focus**: 25 minutes by default. **Pause** and **Resume** freeze it
   exactly; **Stop** ends it early.
2. When the block ends you get a short beep (and a notification, if you
   allowed them) and a **break** starts: 5 minutes by default. **Skip** ends
   the break.
3. When the break ends the timer goes away.

Both lengths are in **Settings → Focus timer**. They apply to the next block
you start, and are saved on that device.

The timer is based on clock time, not a counter, so a slow background tab
can't make it drift, and a block that ran out while the tab was closed is
logged when you come back.

## What gets logged

A finished block logs its full length. Stopping early logs the whole minutes
you actually did (under a minute logs nothing). Time is logged against the
task, shown on its row next to the deadline, and on **Review**:

- **Focus, last 7 days** with the all-time total underneath, and
- **Where the time went**: the tasks the last week's blocks were spent on,
  with their tracks.

If you delete a task, the minutes you spent on it still count, just against
nothing.

Focus sessions are part of the JSON backup and restore. On Supabase, the
timer's log needs the latest `supabase/setup.sql` to have been run.
