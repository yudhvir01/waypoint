---
title: Flashcards
---
# Flashcards

Most flashcard apps make you stop and build cards, and that chore is what
people give up on. Waypoint has no card editor. You write in a note, and the
notes make the cards.

## Making a card

In any note, put a question and an answer on one line, separated by ` :: `
(a space, two colons, a space):

```
What does RAII stand for? :: Resource Acquisition Is Initialization
```

Every line like that becomes a card when the note is saved. The note shows how
many cards it holds, and cards for a note are kept in step with it:

- Reword the **answer** and the card keeps its schedule.
- Reword the **question** and it's a new card, because the question is what
  identifies it.
- Delete the line, or the note, and the card goes too.
- Bold, links and other formatting are ignored; only the text counts.

Notes you wrote before cards existed are picked up the first time you open
**Cards** with none yet: use **Find cards in my notes**.

## Reviewing

Open **Cards** in the sidebar (the number is how many are due today). Show the
answer, then say how it went:

| Button | Key | What happens |
| --- | --- | --- |
| Again | 1 | Back to the start; it comes round again in this session |
| Hard | 2 | A slightly longer gap |
| Good | 3 | The normal step: 1 day, then 3, then growing by the card's ease |
| Easy | 4 | A bigger jump, and the card gets easier |

Space shows the answer, then counts as Good. Each button shows how long until
you'd see the card again.

## A session never buries you

A session holds at most 20 cards, oldest-due first. If more are due, the rest
simply wait; nothing is marked late and nothing piles up as a number to feel
bad about. When you finish you can take another 20 or stop.

Cards are included in the JSON backup and in restore.

On Supabase, cards need the latest `supabase/setup.sql` to have been run.
