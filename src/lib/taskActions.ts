import type { Backend } from "./backend/types";
import type { Task } from "./database.types";
import { nextOccurrence, toDateKey } from "./recurrence";
import { LIMITS } from "./limits";

// A review is an ordinary task named after the one it revisits, so it
// shows up, ticks off and exports like any other.
export const REVIEW_PREFIX = "Review: ";

export const REVIEW_CHOICES_DAYS = [1, 3, 7, 21, 30];

export function isReviewTask(task: Pick<Task, "title">): boolean {
  return task.title.startsWith(REVIEW_PREFIX);
}

export function reviewTitle(title: string): string {
  // Reviewing a review shouldn't make "Review: Review: …".
  const base = title.startsWith(REVIEW_PREFIX) ? title.slice(REVIEW_PREFIX.length) : title;
  return (REVIEW_PREFIX + base).slice(0, LIMITS.taskTitle);
}

export function daysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

const PAGE = 200;

async function listAllTasks(backend: Backend, topicId: string): Promise<Task[]> {
  const all: Task[] = [];
  for (let page = 0; page < 50; page++) {
    const tasks = await backend.listTasks(topicId, page, PAGE);
    all.push(...tasks);
    if (tasks.length < PAGE) break;
  }
  return all;
}

// Adds "Review: <task>" to the task's own topic, due on the chosen day.
// If that review is already waiting, it's moved to the new day rather
// than added twice.
export async function scheduleTaskReview(backend: Backend, task: Task, dueDate: string): Promise<void> {
  const title = reviewTitle(task.title);
  const waiting = (await listAllTasks(backend, task.topic_id)).find((t) => !t.done && t.title === title);
  if (waiting) {
    await backend.updateTaskSchedule(waiting.id, { dueDate });
    return;
  }
  await backend.createTask(task.topic_id, { title, priority: task.priority, dueDate });
}

// Ticking a repeating task leaves its next occurrence behind. This lives
// above the Backend so all three storage options behave the same, and so
// the dashboard and a track page can't drift apart.
export async function toggleTaskWithFollowUps(backend: Backend, task: Task): Promise<void> {
  // The follow-up goes in *before* the tick so the topic never looks
  // finished in between (which would advance its status and bounce back).
  if (!task.done && task.recurrence) {
    await backend.createTask(task.topic_id, {
      title: task.title,
      priority: task.priority,
      dueDate: nextOccurrence(task.due_date, task.recurrence),
      recurrence: task.recurrence,
    });
  }
  await backend.toggleTask(task);
}
