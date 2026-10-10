---
title: The Focus Timer
---
# The Focus Timer

A timer for working in blocks, tied to the task you're on.

## Starting one

- On **Focus Now**, tap a task to open it, then tap **Focus on this**. Or press
  the **▶** at the end of its row.
- On a track's page, use **Start focus timer** in a task's ⋮ menu.
- Or use **Start focus** in the sidebar for a block that isn't about any
  particular task.

A small timer appears in the bottom-right corner of every page and keeps
running as you move around the app. The tab's title shows the clock too, so
you can see it from another tab. The task you're timing is marked
**Focusing** in Focus Now.

## What happens

1. **Focus**: 25 minutes by default. **Pause** and **Resume** freeze it
   exactly; **Stop** ends it early.
2. When the block ends, **nothing starts by itself.** A pop-up says the block
   is done and asks whether to **Start the 5-minute break** or **Skip the
   break**. The break begins when you tap, not before, because you may have put
   the phone down and walked away.
3. **Break**: 5 minutes by default. **Skip** ends it. When it ends you're told,
   and the timer goes away.

There is no beep. The pop-up is on screen until you answer it, and it is still
there if you come back to the app hours later (the break is only offered if the
block ended in the last half hour).

Both lengths are in **Settings → Focus timer**. They apply to the next block
you start, and are saved on that device.

## When the phone is on the desk

- **In the Android app**, the end of a block or a break is delivered as a
  **system notification**, even if the app is closed or the screen is off. The
  first time you start a timer, Android asks to allow notifications; say yes.
  Tapping the notification opens the app on the "start the break" pop-up.
- **In the browser or the installed web app**, the pop-up appears when you
  return. If the page is still open in the background, you also get a browser
  notification that stays until you click it. A closed browser tab can't be
  woken, so for a timer you'll walk away from, use the Android app.

The timer is based on clock time, not a counter, so a slow background tab
can't make it drift, and a block that ran out while the app was closed is
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
