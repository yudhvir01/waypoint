---
title: Add a Task
---
# Add a Task

## TL;DR

- Press **C** anywhere (or tap **+ Add a task**) and type one line in plain
  words.
- When (`tomorrow`, `after 5 days`, `oct 20`), repeats (`every week`) and
  priority (`!high`) are picked out of the text, and the date is worked out
  for you.
- "Remind me to …" works: `remind me to call the bank after 5 days` makes the
  task **call the bank**, due 5 days from today.
- Everything goes to your **To do** list, one plain list with no topics. To
  add a task to a particular topic, use **+ Add task** on that track's page.

Capturing a thought shouldn't mean choosing a track, a topic, a date and a
priority first. Press **C** anywhere in the app (when you're not typing in a
field), or use **+ Add a task** at the top of the sidebar, and write one line.

## What it understands

| Write | You get |
| --- | --- |
| `tomorrow`, `today`, `day after tomorrow`, `next week`, `next month` | a deadline |
| `friday`, `on friday`, `next monday` | the next time that day comes round |
| `in 3 days`, `after 5 days`, `after a week`, `in three months`, `2 days later`, `5 days from now` | a deadline that far from today |
| `oct 15`, `15 oct`, `2026-11-01` | that date (next year if it has passed) |
| `every day`, `daily`, `every weekday`, `every week`, `every month` | a repeating task |
| `every monday` | repeats weekly, starting next Monday |
| `!high` `!medium` `!low` (or `!1` `!2` `!3`) | a priority |
| `remind me to …`, `remind me about …`, `reminder: …` | left out of the task's name |

Numbers can be digits or words up to twelve ("three days"), and "a" or "an"
means one ("after a week"). The same `#priority:high`, `#due:2026-10-20` and
`#repeat:weekly` tags the Markdown import reads work here too.

Before you press Enter, the box shows the task's name and what it understood,
with the worked-out date: *Due Fri, 23 Oct · in 5 days*. Whatever it
understood is removed from the name; anything it doesn't understand stays, so
nothing you typed is lost. For example:

```
remind me to submit the assignment after 3 days !high
```

becomes **"submit the assignment"**, due three days from today, high
priority.

## The To do list

Every task added this way goes to your **To do** list, in the menu right under
**Today**. It's one plain list of things to do: no topics, no trail, no
roadmap. Tick tasks off, hold one to drag it into a new order, or add one
straight there with **+ Add task**. Its tasks show up on Today like anything
else when they're due. (It used to be called the Inbox, and is renamed
automatically.)

The box stays open after you add, so you can capture several in a row; **Esc**
closes it.

To put a task straight into a topic, open that track and use **+ Add task**
under the topic.

## Sorting later

On a track's page, a task's ⋮ menu has **Move to…**. Pick a track and a topic
and the task moves to the end of it; both topics' statuses are kept in step,
and the task's note goes with it.
