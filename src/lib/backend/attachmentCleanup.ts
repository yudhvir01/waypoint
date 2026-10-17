import type { Backend } from "./types";

// Attachments are stored beside the notes, not inside them — a note only
// embeds an attachment's id (see the attachmentImage/attachmentAudio
// nodes in noteAttachments.tsx). So a file outlives the note that used
// it unless something removes it explicitly:
//
//   * deleting a note removes its attachments straight away
//     (removeUnreferencedAttachments, called from each deleteNote);
//   * removing an attachment from a note, or uploading one that never
//     gets saved, queues its id here instead. It isn't safe to delete
//     those on the spot — undo can put the node right back — so the
//     queue is swept the next time the app starts, once an entry is a
//     day old, deleting whatever no note embeds by then.
//
// The queue lives in this device's localStorage, keyed by backend kind.
// Attachment ids are globally unique, so an entry left over from another
// account on the same backend is harmless: it's simply not that
// account's file to delete, and the attempt fails or is a no-op.

const GRACE_MS = 24 * 60 * 60 * 1000;
// An entry that still fails to delete after this long is given up on.
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

type Pending = Record<string, number>;

function storageKey(kind: Backend["kind"]): string {
  return `waypoint:attachment-cleanup:${kind}`;
}

function readPending(kind: Backend["kind"]): Pending {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey(kind)) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Pending) : {};
  } catch {
    return {};
  }
}

function updatePending(kind: Backend["kind"], change: (pending: Pending) => void): void {
  try {
    // Re-read rather than reuse an earlier copy, so another tab's
    // entries written in the meantime aren't dropped.
    const pending = readPending(kind);
    change(pending);
    if (Object.keys(pending).length === 0) localStorage.removeItem(storageKey(kind));
    else localStorage.setItem(storageKey(kind), JSON.stringify(pending));
  } catch {
    // Storage unavailable (private window, blocked site data): the
    // attachment just stays behind, as it did before this existed.
  }
}

// The attachment ids a note's HTML embeds.
export function attachmentIdsIn(content: string): Set<string> {
  return new Set(Array.from(content.matchAll(/data-attachment-id="([^"]+)"/g), (m) => m[1]));
}

// Re-queuing an id restarts its grace period, so an attachment removed
// again after an undo still gets the full day.
export function queueAttachmentCleanup(kind: Backend["kind"], ids: Iterable<string>): void {
  const list = [...ids];
  if (list.length === 0) return;
  const now = Date.now();
  updatePending(kind, (pending) => {
    for (const id of list) pending[id] = now;
  });
}

// Deletes whichever of `ids` no note embeds any more. Anything that
// can't be checked or deleted right now is queued for the next sweep
// rather than failing the caller — by the time this runs, the note
// itself is already gone.
export async function removeUnreferencedAttachments(backend: Backend, ids: Iterable<string>): Promise<void> {
  const wanted = [...new Set(ids)];
  if (wanted.length === 0) return;
  let inUse: Set<string>;
  try {
    inUse = await backend.attachmentsInUse(wanted);
  } catch {
    queueAttachmentCleanup(backend.kind, wanted);
    return;
  }
  const failed: string[] = [];
  await Promise.all(
    wanted
      .filter((id) => !inUse.has(id))
      .map(async (id) => {
        try {
          await backend.deleteAttachment(id);
        } catch {
          failed.push(id);
        }
      }),
  );
  queueAttachmentCleanup(backend.kind, failed);
}

// Run once per backend, when the app starts.
export async function sweepAttachmentCleanup(backend: Backend): Promise<void> {
  const now = Date.now();
  const pending = readPending(backend.kind);
  const due = Object.keys(pending).filter((id) => now - pending[id] >= GRACE_MS);
  if (due.length === 0) return;

  const inUse = await backend.attachmentsInUse(due);
  const settled: string[] = [];
  await Promise.all(
    due.map(async (id) => {
      if (inUse.has(id)) {
        settled.push(id);
        return;
      }
      try {
        await backend.deleteAttachment(id);
        settled.push(id);
      } catch {
        if (now - pending[id] >= MAX_AGE_MS) settled.push(id);
      }
    }),
  );
  updatePending(backend.kind, (latest) => {
    // Skip ids re-queued by another tab while this sweep ran.
    for (const id of settled) if (latest[id] === pending[id]) delete latest[id];
  });
}
