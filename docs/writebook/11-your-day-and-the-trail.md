---
title: Your Day and the Trail
---
# Your Day and the Trail

## TL;DR

- Morning: **Today** asks you to pick up to three tasks, starting with what you
  left yesterday.
- Evening: **Close the day** asks for one line about what moved. That line is a
  **waypoint**.
- Each track's **Trail** shows where it's headed, the topics ahead, **you are
  here**, and every line you've written on it, back to the day you started.
- On your own Supabase project, re-run `supabase/setup.sql` once to get these.

Waypoint has a beginning and an end to each day. In the morning you pick a few
things to do. In the evening you write one line about what moved. Over weeks,
those lines become the trail on each of your tracks: where it's headed, where you
are, and how far you've come.

## Opening the day

**Today** is the first thing you see. Until you've picked anything, it asks you
to **pick up to three for today**:

- **Left from yesterday** lists yesterday's picks you didn't finish, first, so
  nothing quietly falls off. Tap **+ Today** to carry one over.
- **Suggested** is the ranked list that used to be called Focus Now: overdue
  first, then due soon, then priority, then the topic you're in the middle of.
  Tap **+ Today** to pick one.

Three is the limit on what's still open, not on the day: finish one and you can
pick another. Tap a task to open it in place; **Not today** puts a pick back with the
rest. With three picked, everything else folds away under **Everything else**.

Picks follow you between your phone and your computer.

Under your picks, one quiet line tells you when something else wants a moment:
cards to review, things waiting in the Inbox, or tasks that have slipped. Those
used to be pages of their own in the sidebar; they're one tap away from here.

## Closing the day

At the bottom of Today, **Close the day** asks one question: *what did you
learn or get done today?* Write a line and press **Enter** (or **Save the
day**). It goes on the track most of today's finished picks came from; change
that with the **on** menu, or choose **No track**.

That line is a **waypoint**. Write another with **+ Another line** if the day
touched more than one track. Tomorrow, Today opens with yesterday's line at the
top, so each day starts where the last one ended.

## The trail

A track's page opens on its **Trail**, with **Tasks** one tap away (it
remembers which you used last). Read from the top:

1. **Headed to.** One sentence on why the track exists or where it ends. Tap it
   to change it. It's the track's description, so a Markdown import's
   description line fills it in.
2. **Ahead.** The next few topics you haven't reached, on a dashed line.
3. **You are here.** The topic you're in, how many tasks are left in it, and the
   topics already behind you. If you haven't written today's line for this
   track, you can write it right here.
4. **The trail itself.** Every line you've written on this track, newest first,
   one stop per day, back to the day you set out.

Tap any topic on the trail to jump to it in **Tasks**.

## Supabase: re-run the setup script

Picks and waypoints need two things added to your database. Re-run
`supabase/setup.sql` in the SQL Editor; it's safe to re-run and only adds what's
missing. Until then, Today shows the ranked list as before and says what to do.
Guest mode and Google Drive need nothing.
