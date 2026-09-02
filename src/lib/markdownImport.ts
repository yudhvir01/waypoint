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

const TRACK_HEADING = /^#\s+(.+?)\s*$/;
const TOPIC_HEADING = /^##\s+(.+?)\s*$/;
const TASK_LINE = /^-\s*\[([ xX])\]\s*(.*)$/;
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

export function parseImportMarkdown(input: string): ParsedImport {
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const warnings: string[] = [];

  let trackName: string | null = null;
  const descriptionLines: string[] = [];
  const topics: ParsedTopic[] = [];
  let currentTopic: ParsedTopic | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;

    if (!line.startsWith("##")) {
      const trackMatch = line.match(TRACK_HEADING);
      if (trackMatch) {
        if (trackName !== null) {
          warnings.push(
            `Second "# ${trackMatch[1]}" heading found — only the first track heading is used.`,
          );
          continue;
        }
        trackName = trackMatch[1];
        continue;
      }
    }

    const topicMatch = line.match(TOPIC_HEADING);
    if (topicMatch) {
      currentTopic = { title: topicMatch[1], tasks: [] };
      topics.push(currentTopic);
      continue;
    }

    const taskMatch = line.match(TASK_LINE);
    if (taskMatch) {
      if (!currentTopic) {
        warnings.push(`Task "${taskMatch[2].trim()}" found before any topic heading — skipped.`);
        continue;
      }
      const done = taskMatch[1].toLowerCase() === "x";
      const { title, priority, dueDate } = extractTags(taskMatch[2].trim(), warnings, taskMatch[2].trim());
      if (!title) {
        warnings.push(`A task line under "${currentTopic.title}" had no text — skipped.`);
        continue;
      }
      currentTopic.tasks.push({ title, done, priority, dueDate });
      continue;
    }

    // Plain text: description if it's between the track heading and the
    // first topic, otherwise it doesn't match any rule.
    if (trackName !== null && topics.length === 0) {
      descriptionLines.push(line.trim());
    } else if (currentTopic) {
      warnings.push(`Unexpected line under "${currentTopic.title}" — ignored: "${line.trim()}"`);
    } else {
      warnings.push(`Unexpected line — ignored: "${line.trim()}"`);
    }
  }

  if (!trackName) {
    throw new Error('No track heading found. The file must start with "# Track Name".');
  }
  if (topics.length === 0) {
    throw new Error('No topics found. Add at least one "## Topic Title" heading.');
  }

  const description = descriptionLines.join(" ") || null;

  return { trackName, description, topics, warnings };
}
