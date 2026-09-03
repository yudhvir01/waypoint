// A ready-made prompt the user can hand to any AI chat (ChatGPT, Claude,
// etc.) alongside their own messy notes, so the AI does the restructuring
// into Waypoint's import format instead of the user doing it by hand.
export const IMPORT_AI_PROMPT = `You're helping me convert my notes into a specific Markdown format for an app called Waypoint, which turns Markdown into Track → Topic → Task data. Output ONLY the converted Markdown — no commentary before or after, and don't wrap the whole thing in a code fence.

The format:

- The very first line must be a single "#" heading — this becomes the Track name. Pick a short, clear name for what this overall roadmap/project/goal is about.
- Optionally, 1-2 sentences of plain text right after that heading become the track's description.
- Every Topic in the output must use a "##" heading. Source heading levels such as "###" or "####" do not matter. Flatten unnecessary heading nesting into separate "##" topics.
- A section should become a Topic when it contains concrete actionable items. Give topics short, specific names such as "Python", "Docker", "Smart Pointers" rather than vague names like "Objective" or "Goal".
- Under each topic heading, list the actual actionable items as bullets:
  - "- [ ] Task text" for something not done yet
  - "- [x] Task text" for something already done
- Optionally tag a task with:
  - "#priority:high", "#priority:medium", or "#priority:low" — only when the source material actually implies urgency. Do not invent priorities.
  - "#due:YYYY-MM-DD" — only if there's a real target date in my notes. Do not invent one.
- Don't nest headings more than necessary. If a section naturally has sub-groups, make each meaningful sub-group its own "##" topic instead of creating "###" or deeper nesting.
- The same topic name is allowed to repeat under different top-level sections. Waypoint automatically disambiguates duplicate topic names, so don't rename them yourself to work around it.
- Preserve all meaningful actionable content. Do not drop skills, technologies, project requirements, features, checklist items, or other concrete work.
- Leave out only content that is purely explanatory and cannot reasonably represent a task, such as mission statements, mindset notes, ASCII diagrams, or general prose. If short contextual prose is useful for understanding the overall roadmap, fold it into the track description instead.
- Do not invent tasks that are not supported by the source. When a source item is not already an action but clearly represents something that needs to be learned, built, configured, read, implemented, or completed, convert it into a concise actionable task without adding unsupported scope.
- Break big vague goals into smaller concrete steps only when those steps are actually implied by the source material. Do not invent additional steps.
- Preserve "[x]" completion status from the source wherever it exists.
- Do not create due dates or priorities unless they are explicitly or clearly implied by the source.
- The final output must contain exactly one "#" Track heading and one or more "##" Topic headings. Do not output any other heading levels.

Here's what I'm working with — restructure all of it into the format above. Don't summarize the content; reorganize it while preserving its meaningful actionable information:

`;
