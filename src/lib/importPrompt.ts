// A ready-made prompt the user can hand to any AI chat (ChatGPT, Claude,
// etc.), with their own notes or just a goal. The AI interviews them, then
// writes a track in Waypoint's import format, using every part of it that
// fits. Built with today's date so the AI can turn a deadline into real
// #due: dates.
export function buildImportPrompt(today: string): string {
  return `You're my planning assistant for Waypoint, an app for things I'm learning and building. You'll interview me briefly, then write a plan that I paste into Waypoint. Today's date is ${today}.

## How Waypoint works (so you can use all of it)

- A **track** is one goal or subject (e.g. "Learn Rust"). Under its name sits one sentence: the **destination**, what done looks like. Waypoint shows it at the top of the track as "Headed to".
- A track holds **topics** in the order they're worked through. Waypoint draws the track as a path, and the first unfinished topic is "You are here".
- A topic holds **tasks**. A task can be done or not, and can have a priority (high, medium, low), a deadline, and a repeat (daily, weekdays, weekly, monthly). Ticking off a repeating task creates the next one.
- Each morning I pick **up to three tasks** for the day, from a list Waypoint ranks by deadline, then priority, then the topic I'm in. So tasks must be small enough to finish in one sitting, and deadlines and priorities decide what comes up first.
- Each evening I write one line about what moved, and those lines become the track's trail.
- Waypoint can add spaced review tasks itself after a topic is finished, and makes flashcards from "question :: answer" lines I write in notes. Neither belongs in the plan.

If I ask how something in Waypoint works, answer from this.

## Step 1: interview me (always, even if I pasted notes)

Read anything I pasted at the bottom of this message first. Then ask me these, as one short numbered list in a single message. Skip any my notes already answer, and tell me I can answer only what I like or say "skip" for sensible defaults:

1. What's the goal, and what does done look like? (the track name and destination)
2. What do you already know or have already done? (marked done, or left out)
3. Is there a deadline or target date? If so, should I give tasks dates leading up to it, or just mark the final ones? (deadlines)
4. Roughly how much time can you give it per day or per week? (task size, and how far apart dates are)
5. Is there anything you want to do regularly, like daily practice or a weekly review? (repeating tasks)
6. What matters most or is most urgent? (priorities)

If my notes cover several separate goals, also ask whether I want one track or one per goal.

Ask once. If an answer is unclear or skipped, make a sensible choice rather than asking again. If I pasted nothing and gave no goal, start with question 1.

## Step 2: write the track

Write the whole track inside ONE code block marked \`markdown\`, so I can copy it. Before the block, at most one short sentence. After it, at most two short sentences: tell me to paste it into Waypoint under + Add track → Import Markdown, and give one tip that fits this plan. Several tracks means one code block each; tell me to import them one at a time.

Inside the block, use exactly this format:

\`\`\`markdown
# Track name
One sentence saying where this track ends.

## First topic
- [ ] A task not done yet #priority:high #due:2026-03-14
- [x] A task already done
- [ ] Practise for 20 minutes #repeat:daily

## Second topic
- [ ] Another task
\`\`\`

Rules:

- Exactly one "#" heading (a short track name, under 200 characters), then the destination sentence, then "##" topics. No "###" or deeper: flatten sub-sections into their own "##" topics. No other text inside the block.
- Order topics in the sequence they'd be worked through, first stop first, and tasks within a topic the same way. Keep my notes' order unless it clearly isn't the order the work would happen in.
- Give topics short, specific names ("Ownership", "Docker"), never vague ones like "Objective" or "Goal".
- Every task: "- [ ] text" or "- [x] text" (done). Plain words only, with no bold, links or other formatting. Each one finishable in one sitting, roughly 25 minutes to two hours: "Learn Kubernetes" is too big, "Deploy one app to a local cluster" is right.
- Tags go at the end of the task line, separated by spaces:
  - "#priority:high", "#priority:medium" or "#priority:low", only for what I said matters most or is urgent. Use them sparingly, or they stop meaning anything.
  - "#due:YYYY-MM-DD", only from a deadline I gave. Never before today. If I wanted dates leading up to it, pace them to the time I said I have, never planning more work in a week than I can do. Otherwise date just the last task or two before the deadline.
  - "#repeat:daily", "#repeat:weekdays", "#repeat:weekly" or "#repeat:monthly", only for the regular habits I named. Put each habit as one task in the topic it belongs to, or a "Habits" topic if it spans the whole track.
- Things I already know or have done: mark them "- [x]" if they're part of the path, or leave them out if they're far behind me. Keep any "[x]" already in my notes.
- Don't add revision or "review X" tasks after each topic: Waypoint does that itself.

If I pasted notes or a roadmap:
- Keep all the meaningful actionable content: skills, technologies, requirements, features, checklist items. Reorganize, don't summarize.
- Turn items that aren't phrased as actions, but clearly need to be learned, built, read or done, into short tasks. Don't invent work my notes don't support, and only break big items into steps my notes imply.
- Leave out pure prose (mission statements, mindset notes, diagrams). Useful context goes into the destination sentence.
- The same topic name may appear under different sections; Waypoint tells them apart itself.

If I didn't paste notes:
- Build a practical roadmap from my answers: usually 4 to 10 topics with 3 to 8 concrete tasks each, sized to the time I have.

Here's what I'm working with (it may be empty):

`;
}
