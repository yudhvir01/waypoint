import type { Backend } from "./backend/types";
import type { Confidence, Task, Topic } from "./database.types";
import { getSpacedRevisit } from "./preferences";
import { nextOccurrence, toDateKey } from "./recurrence";

// Where review tasks are collected, per track. Matched by title: it is
// what a person sees, and renaming it just means a new one is made.
export const REVIEWS_TOPIC_TITLE = "Reviews";

// Days after finishing a topic that it comes back for a quick recall.
// A topic you marked shaky comes back sooner and more often; one you know
// cold, later and less. Unrated gets the middle schedule.
export const REVIEW_OFFSETS_DAYS = [3, 7, 21];
export function reviewOffsets(confidence?: Confidence | null): number[] {
  if (confidence === "shaky") return [1, 3, 7];
  if (confidence === "solid") return [7, 30];
  return REVIEW_OFFSETS_DAYS;
}

// Finishing a big roadmap would otherwise book dozens of reviews at once,
// which is how a to-do list turns into a source of guilt. Past this many
// open reviews on a track, new ones wait until some are done.
export const MAX_OPEN_REVIEWS_PER_TRACK = 12;

const PAGE = 200;

async function findTopic(backend: Backend, trackId: string, match: (t: Topic) => boolean): Promise<Topic | null> {
  for (let page = 0; page < 50; page++) {
    const topics = await backend.listTopics(trackId, page, PAGE);
    const found = topics.find(match);
    if (found) return found;
    if (topics.length < PAGE) break;
  }
  return null;
}

async function listAllTasks(backend: Backend, topicId: string): Promise<Task[]> {
  const all: Task[] = [];
  for (let page = 0; page < 50; page++) {
    const tasks = await backend.listTasks(topicId, page, PAGE);
    all.push(...tasks);
    if (tasks.length < PAGE) break;
  }
  return all;
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

// Files "Review: <topic>" tasks into the track's Reviews topic. Safe to
// call twice for the same topic: a review that is still open is never
// added a second time.
export async function scheduleTopicReviews(
  backend: Backend,
  trackId: string,
  topicTitle: string,
  confidence?: Confidence | null,
): Promise<void> {
  if (topicTitle === REVIEWS_TOPIC_TITLE) return;
  let reviews = await findTopic(backend, trackId, (t) => t.title === REVIEWS_TOPIC_TITLE);
  if (!reviews) reviews = await backend.createTopic(trackId, REVIEWS_TOPIC_TITLE);

  const openTitles = (await listAllTasks(backend, reviews.id)).filter((t) => !t.done).map((t) => t.title);
  const open = new Set(openTitles);
  let openCount = openTitles.length;
  let added = 0;
  for (const days of reviewOffsets(confidence)) {
    if (openCount >= MAX_OPEN_REVIEWS_PER_TRACK) break;
    const title = `Review: ${topicTitle} (day ${days})`;
    if (open.has(title)) continue;
    await backend.createTask(reviews.id, { title, dueDate: addDays(days) });
    added++;
    openCount++;
  }
  // New open work in a finished Reviews topic would otherwise sit under a
  // "done" label.
  if (added > 0 && reviews.status === "done") await backend.updateTopicStatus(reviews.id, "in_progress");
}

// Ticking a task is more than flipping a flag:
//  - a repeating task leaves its next occurrence behind, and
//  - finishing the last task of a topic books its spaced reviews.
// This lives above the Backend so all three storage options behave the
// same, and so the dashboard and a track page can't drift apart.
export async function toggleTaskWithFollowUps(backend: Backend, task: Task): Promise<void> {
  const completing = !task.done;

  // The follow-up goes in *before* the tick so the topic never looks
  // finished in between (which would advance its status and bounce back).
  if (completing && task.recurrence) {
    await backend.createTask(task.topic_id, {
      title: task.title,
      priority: task.priority,
      dueDate: nextOccurrence(task.due_date, task.recurrence),
      recurrence: task.recurrence,
    });
  }

  await backend.toggleTask(task);

  if (!completing || !getSpacedRevisit()) return;
  try {
    const progress = (await backend.topicProgress(task.track_id)).get(task.topic_id);
    if (!progress || progress.total === 0 || progress.done < progress.total) return;
    const topic = await findTopic(backend, task.track_id, (t) => t.id === task.topic_id);
    // Reviews don't spawn reviews of themselves.
    if (!topic || topic.title === REVIEWS_TOPIC_TITLE) return;
    await scheduleTopicReviews(backend, task.track_id, topic.title, topic.confidence);
  } catch {
    // The task is already ticked; a failed bonus must not surface as a
    // failed tick.
  }
}
