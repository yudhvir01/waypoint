import type { CardSchedule } from "./backend/types";
import type { Card } from "./database.types";
import { fromDateKey, toDateKey } from "./recurrence";

// ---------------------------------------------------------------------
// Making cards out of notes
//
// There's no card editor. A line in a note written as
//
//     What does RAII stand for? :: Resource Acquisition Is Initialization
//
// is a card. Writing the note is making the cards, which is the step
// that makes people abandon flashcard apps (it takes longer than the
// reviewing does).
// ---------------------------------------------------------------------

export interface WantedCard {
  front: string;
  back: string;
}

const MAX_SIDE = 600;
const SEPARATOR = /^(.+?)\s::\s(.+)$/;

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

// Whitespace is collapsed so that a card's identity (its front) doesn't
// change when someone adds a space or the editor re-wraps a line.
export function normalizeSide(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function extractCards(html: string): WantedCard[] {
  const text = decodeEntities(
    html
      // Block ends and hard breaks are where one line stops and the next
      // starts; everything else inside a line is just formatting.
      .replace(/<\/(p|li|h[1-6]|div|blockquote|pre)>|<br\s*\/?>/gi, "\n")
      .replace(/<[^>]*>/g, ""),
  );
  const seen = new Set<string>();
  const cards: WantedCard[] = [];
  for (const line of text.split("\n")) {
    const match = SEPARATOR.exec(normalizeSide(line));
    if (!match) continue;
    const front = normalizeSide(match[1]);
    const back = normalizeSide(match[2]);
    if (!front || !back || front.length > MAX_SIDE || back.length > MAX_SIDE) continue;
    // Two cards with the same question in one note would be one card.
    const key = front.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cards.push({ front, back });
  }
  return cards;
}

export interface CardDiff {
  create: WantedCard[];
  updateBack: { id: string; back: string }[];
  remove: string[];
}

// What has to change so a note's stored cards match what it now says. A
// card is matched by its question, so a card whose answer you reworded
// keeps its schedule, and one whose question you rewrote is a new card.
export function diffCards(existing: Pick<Card, "id" | "front" | "back">[], wanted: WantedCard[]): CardDiff {
  const byFront = new Map(existing.map((c) => [c.front.toLowerCase(), c]));
  const wantedFronts = new Set(wanted.map((w) => w.front.toLowerCase()));
  const diff: CardDiff = { create: [], updateBack: [], remove: [] };

  for (const w of wanted) {
    const have = byFront.get(w.front.toLowerCase());
    if (!have) diff.create.push(w);
    else if (have.back !== w.back) diff.updateBack.push({ id: have.id, back: w.back });
  }
  for (const c of existing) {
    if (!wantedFronts.has(c.front.toLowerCase())) diff.remove.push(c.id);
  }
  return diff;
}

// ---------------------------------------------------------------------
// Scheduling
//
// A small SM-2 variant on whole days. Intervals grow by the card's ease
// each time you get it right and drop back when you don't.
// ---------------------------------------------------------------------

export type Grade = "again" | "hard" | "good" | "easy";
export const GRADES: Grade[] = ["again", "hard", "good", "easy"];

export const NEW_CARD_EASE = 2.5;
const MIN_EASE = 1.3;
const MAX_INTERVAL_DAYS = 365;

// A session is capped so the queue can't turn into a debt. Cards beyond
// it simply wait a day; nothing is lost and nothing is marked "behind".
export const SESSION_LIMIT = 20;

export function newCardSchedule(now = new Date()): CardSchedule {
  return {
    due: toDateKey(now),
    interval_days: 0,
    ease: NEW_CARD_EASE,
    reps: 0,
    lapses: 0,
    last_reviewed_at: null,
  };
}

export function scheduleCard(
  card: Pick<Card, "interval_days" | "ease" | "reps" | "lapses">,
  grade: Grade,
  now = new Date(),
): CardSchedule {
  let { interval_days: interval, ease, reps, lapses } = card;

  switch (grade) {
    case "again":
      // Back to the start of learning: due again today.
      if (reps > 0) lapses += 1;
      ease = Math.max(MIN_EASE, ease - 0.2);
      interval = 0;
      reps = 0;
      break;
    case "hard":
      ease = Math.max(MIN_EASE, ease - 0.15);
      interval = interval === 0 ? 1 : Math.max(interval + 1, Math.round(interval * 1.2));
      reps += 1;
      break;
    case "good":
      interval =
        reps === 0 ? 1 : reps === 1 ? 3 : Math.max(interval + 1, Math.round(interval * ease));
      reps += 1;
      break;
    case "easy":
      ease += 0.15;
      interval = reps === 0 ? 4 : Math.max(interval + 2, Math.round(interval * ease * 1.3));
      reps += 1;
      break;
  }
  interval = Math.min(interval, MAX_INTERVAL_DAYS);

  const due = fromDateKey(toDateKey(now));
  due.setDate(due.getDate() + interval);
  return {
    due: toDateKey(due),
    interval_days: interval,
    ease: Math.round(ease * 100) / 100,
    reps,
    lapses,
    last_reviewed_at: now.toISOString(),
  };
}

// "1d", "3d", "2mo" — what a grade would do, shown on its button.
export function intervalLabel(days: number): string {
  if (days <= 0) return "today";
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return "1y";
}

export interface Session {
  queue: Card[];
  dueTotal: number;
  waiting: number;
}

export function isDue(card: Pick<Card, "due">, today = new Date()): boolean {
  return card.due <= toDateKey(today);
}

// Cards due today or overdue, most overdue first, capped at `limit`.
export function buildSession(cards: Card[], limit = SESSION_LIMIT, today = new Date()): Session {
  const due = cards
    .filter((c) => isDue(c, today))
    .sort((a, b) => a.due.localeCompare(b.due) || a.created_at.localeCompare(b.created_at));
  return { queue: due.slice(0, limit), dueTotal: due.length, waiting: Math.max(0, due.length - limit) };
}

export function nextDueDate(cards: Card[], today = new Date()): string | null {
  const todayKey = toDateKey(today);
  const upcoming = cards.map((c) => c.due).filter((d) => d > todayKey).sort();
  return upcoming[0] ?? null;
}
