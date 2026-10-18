// A ready-made prompt the user can hand to any AI chat (ChatGPT, Claude,
// etc.) alongside their own messy notes, so the AI does the restructuring
// into Waypoint's import format instead of the user doing it by hand.
export const IMPORT_AI_PROMPT = `You're helping me convert my notes into a specific Markdown format for an app called Waypoint, which turns Markdown into Track → Topic → Task data.

FIRST, check what I actually gave you at the bottom of this message. If I pasted real notes, a roadmap, or a plan, skip straight to converting them. But if there's nothing there — or I just pasted this prompt on its own without any notes — don't output anything yet and don't make up content. Instead, guide me: say something like "Okay, to prepare a roadmap I'll need a plan, or something you want to learn or achieve." Then ask me a few short questions, one or two at a time: what the goal is, what I already know, how much time I have each week, and any deadline. Once I've answered, build a practical roadmap from my answers and then convert it into the format below. In that case my answers are the source material: a deadline I gave can become "#due:" dates on the tasks it applies to, and things I said I'd keep doing regularly can become repeating tasks.

When you do produce the final result, output ONLY the converted Markdown — no commentary before or after, and don't wrap the whole thing in a code fence.

The format:

- The very first line must be a single "#" heading — this becomes the Track name. Pick a short, clear name for what this overall roadmap/project/goal is about.
- Right after that heading, write ONE plain sentence saying where this track ends — what done looks like (for example "Ship a small Rust CLI and be comfortable reading other people's Rust."). Waypoint shows it at the top of the track as the destination. Use only what the source supports; leave it out if there's nothing to go on.
- Every Topic in the output must use a "##" heading. Source heading levels such as "###" or "####" do not matter. Flatten unnecessary heading nesting into separate "##" topics.
- Order the topics in the sequence I'd actually work through them, first stop first. Waypoint draws the track as a path and treats the first unfinished topic as "you are here", so the order matters. Keep the source's order unless it's clearly not the order the work would happen in.
- A section should become a Topic when it contains concrete actionable items. Give topics short, specific names such as "Python", "Docker", "Smart Pointers" rather than vague names like "Objective" or "Goal".
- Under each topic heading, list the actual actionable items as bullets:
  - "- [ ] Task text" for something not done yet
  - "- [x] Task text" for something already done
- Within a topic, list tasks in the order they'd be done.
- Make each task something that can be finished in one sitting (roughly 25 minutes to a couple of hours). Each day I pick up to three tasks to work on, so a task like "Learn Kubernetes" is too big — but only split it into steps the source actually implies.
- Write task text as plain words: no bold, links, or other Markdown formatting inside the task line.
- Optionally tag a task with:
  - "#priority:high", "#priority:medium", or "#priority:low" — only when the source material actually implies urgency. Do not invent priorities.
  - "#due:YYYY-MM-DD" — only if there's a real target date in my notes. Do not invent one.
  - "#repeat:daily", "#repeat:weekdays", "#repeat:weekly", or "#repeat:monthly" — only for something the source says is done on a schedule (a daily practice, a weekly review). Do not add repeats otherwise.
  - Tags go at the end of the task line, separated by spaces, for example "- [ ] Solve two practice problems #repeat:weekdays #priority:medium".
- Don't nest headings more than necessary. If a section naturally has sub-groups, make each meaningful sub-group its own "##" topic instead of creating "###" or deeper nesting.
- The same topic name is allowed to repeat under different top-level sections. Waypoint automatically disambiguates duplicate topic names, so don't rename them yourself to work around it.
- Preserve all meaningful actionable content. Do not drop skills, technologies, project requirements, features, checklist items, or other concrete work.
- Leave out only content that is purely explanatory and cannot reasonably represent a task, such as mission statements, mindset notes, ASCII diagrams, or general prose. If short contextual prose is useful for understanding the overall roadmap, fold it into the track description instead.
- Do not invent tasks that are not supported by the source. When a source item is not already an action but clearly represents something that needs to be learned, built, configured, read, implemented, or completed, convert it into a concise actionable task without adding unsupported scope.
- Break big vague goals into smaller concrete steps only when those steps are actually implied by the source material. Do not invent additional steps.
- Preserve "[x]" completion status from the source wherever it exists.
- Do not create due dates, priorities, or repeats unless they are explicitly or clearly implied by the source.
- The final output must contain exactly one "#" Track heading and one or more "##" Topic headings. Do not output any other heading levels.

Here's what I'm working with — restructure all of it into the format above. Don't summarize the content; reorganize it while preserving its meaningful actionable information. (If nothing follows this line, ask me what I want to plan or learn, as described at the top.)

`;
