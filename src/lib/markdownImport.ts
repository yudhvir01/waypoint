import type { TaskPriority } from "./database.types";

export interface ParsedTask {
  title: string;
  done: boolean;
  priority: TaskPriority;
  dueDate: string | null;
}

export interface ParsedTopic {
  title: string;
  tasks: ParsedTask[];
}

export interface ParsedImport {
  trackName: string;
  description: string | null;
  topics: ParsedTopic[];
  warnings: string[];
}

const HEADING = /^(#{1,6})\s+(.+?)\s*$/;
const CHECKBOX_ITEM = /^[-*+]\s*\[([ xX])\]\s*(.*)$/;
const PLAIN_ITEM = /^[-*+]\s+(.+)$/;
const HR = /^(-{3,}|\*{3,}|_{3,})$/;
const FENCE = /^```/;
const TAG = /#(\w+):(\S+)/g;

function extractTags(
  rawTitle: string,
  warnings: string[],
  context: string,
): { title: string; priority: TaskPriority; dueDate: string | null } {
  let priority: TaskPriority = "none";
  let dueDate: string | null = null;
  let title = rawTitle;

  title = title.replace(TAG, (match, key: string, value: string) => {
    const lowerKey = key.toLowerCase();

    if (lowerKey === "priority") {
      const lowerValue = value.toLowerCase();
      if (lowerValue === "low" || lowerValue === "medium" || lowerValue === "high") {
        priority = lowerValue;
        return "";
      }
      warnings.push(`Unrecognized priority "${value}" on "${context}" — left as-is.`);
      return match;
    }

    if (lowerKey === "due") {
      const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
      if (isValidDate) {
        dueDate = value;
        return "";
      }
      warnings.push(`Unrecognized date "${value}" on "${context}" — left as-is.`);
      return match;
    }

    warnings.push(`Unrecognized tag "#${key}:${value}" on "${context}" — left as-is.`);
    return match;
  });

  return { title: title.replace(/\s+/g, " ").trim(), priority, dueDate };
}

interface TopicCandidate extends ParsedTopic {
  // The nearest enclosing top-level (#) heading, used to disambiguate
  // topics that end up with the same name (e.g. "Tech Stack" repeated
  // under five different top-level project sections).
  topLevelAncestor: string | null;
}

export function parseImportMarkdown(input: string): ParsedImport {
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const warnings: string[] = [];

  let trackName: string | null = null;
  const descriptionLines: string[] = [];
  const topics: TopicCandidate[] = [];
  let currentTopic: TopicCandidate | null = null;
  let topLevelAncestor: string | null = null;
  let inCodeBlock = false;
  let skippedBlocks = 0;
  let skippedLines = 0;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (inCodeBlock) {
      if (FENCE.test(trimmed)) {
        inCodeBlock = false;
        skippedBlocks++;
      }
      continue;
    }
    if (FENCE.test(trimmed)) {
      inCodeBlock = true;
      continue;
    }
    if (!trimmed) continue;
    if (HR.test(trimmed)) continue;

    const headingMatch = trimmed.match(HEADING);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = headingMatch[2];

      if (trackName === null) {
        if (level !== 1) {
          // Content can't start with a sub-heading — nothing to attach it
          // to yet. Skip until the real track heading shows up.
          skippedLines++;
          continue;
        }
        trackName = title;
        currentTopic = null;
        continue;
      }

      if (level === 1) topLevelAncestor = title;

      // Every heading below the track name is a topic *candidate* — it
      // only survives into the final result if list items actually turn
      // up underneath it before the next heading.
      currentTopic = { title, tasks: [], topLevelAncestor: level === 1 ? null : topLevelAncestor };
      topics.push(currentTopic);
      continue;
    }

    const checkboxMatch = trimmed.match(CHECKBOX_ITEM);
    const plainMatch = checkboxMatch ? null : trimmed.match(PLAIN_ITEM);

    if (checkboxMatch || plainMatch) {
      const done = checkboxMatch ? checkboxMatch[1].toLowerCase() === "x" : false;
      const rawText = (checkboxMatch ? checkboxMatch[2] : plainMatch![1]).trim();

      if (!currentTopic) {
        warnings.push(`Task "${rawText}" found before any topic heading — skipped.`);
        continue;
      }
      const { title, priority, dueDate } = extractTags(rawText, warnings, rawText);
      if (!title) {
        warnings.push(`A task line under "${currentTopic.title}" had no text — skipped.`);
        continue;
      }
      currentTopic.tasks.push({ title, done, priority, dueDate });
      continue;
    }

    // A blockquote or plain paragraph line. Before the first topic-worthy
    // heading it becomes the track description; after that it's just
    // explanatory prose (a goal statement, a note) with nothing to attach
    // it to structurally, so it's counted rather than spelled out line by
    // line — a 500-line roadmap can easily have 50+ of these.
    const text = trimmed.startsWith(">") ? trimmed.replace(/^>\s?/, "") : trimmed;
    if (topics.length === 0) {
      descriptionLines.push(text);
    } else {
      skippedLines++;
    }
  }

  if (!trackName) {
    throw new Error('No track heading found. The file must start with "# Track Name".');
  }

  const nonEmptyTopics = topics.filter((t) => t.tasks.length > 0);
  if (nonEmptyTopics.length === 0) {
    throw new Error(
      "No topics with tasks found. Add at least one heading followed by \"- [ ] a task\" or \"- a task\".",
    );
  }

  // Disambiguate topics that share a title (common with a "Tech Stack" /
  // "Features" heading repeated under several projects) by tagging on the
  // nearest top-level section they came from — but only when it's actually
  // ambiguous, so a normal file's topic titles are never touched.
  const titleCounts = new Map<string, number>();
  for (const t of nonEmptyTopics) titleCounts.set(t.title, (titleCounts.get(t.title) ?? 0) + 1);
  for (const t of nonEmptyTopics) {
    if ((titleCounts.get(t.title) ?? 0) > 1 && t.topLevelAncestor && t.topLevelAncestor !== t.title) {
      t.title = `${t.title} (${t.topLevelAncestor})`;
    }
  }

  if (skippedBlocks > 0) {
    warnings.push(
      `${skippedBlocks} code or diagram block${skippedBlocks === 1 ? "" : "s"} skipped — not something Waypoint can turn into tasks.`,
    );
  }
  if (skippedLines > 0) {
    warnings.push(
      `${skippedLines} line${skippedLines === 1 ? "" : "s"} of explanatory text weren't recognized as tasks — skipped.`,
    );
  }

  const description = descriptionLines.join(" ").replace(/\*\*(.*?)\*\*/g, "$1").trim() || null;

  return {
    trackName,
    description,
    topics: nonEmptyTopics.map(({ title, tasks }) => ({ title, tasks })),
    warnings,
  };
}
