import type { GoogleDriveSession } from "./googleAuth";

const FOLDER_NAME = "Waypoint";
const DATA_FILE_NAME = "waypoint-data.json";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";

// Thrown when a write's precondition check finds the file has moved on
// since it was last read — another tab or device saved in between. The
// caller (DriveBackend) surfaces this rather than silently overwriting
// whatever the other write did.
export class DriveConflictError extends Error {
  constructor() {
    super("Your Waypoint data changed elsewhere since this tab last loaded it.");
  }
}

async function driveFetch(session: GoogleDriveSession, url: string, init: RequestInit = {}): Promise<Response> {
  const token = await session.getAccessToken();
  const res = await fetch(url, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Drive request failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return res;
}

async function findByName(
  session: GoogleDriveSession,
  name: string,
  mimeType: string,
  parent: string | null,
): Promise<{ id: string; headRevisionId?: string } | null> {
  const q = [
    `name = '${name.replace(/'/g, "\\'")}'`,
    `mimeType = '${mimeType}'`,
    "trashed = false",
    parent ? `'${parent}' in parents` : null,
  ]
    .filter(Boolean)
    .join(" and ");

  const url = `${DRIVE_API}?q=${encodeURIComponent(q)}&fields=files(id,headRevisionId)&spaces=drive`;
  const res = await driveFetch(session, url);
  const data = (await res.json()) as { files: { id: string; headRevisionId?: string }[] };
  return data.files[0] ?? null;
}

// drive.file grants the app permanent access to anything it creates —
// not just for the session that created it — so a returning user's
// existing folder and file are found by name rather than recreated.
export async function ensureWaypointFolder(session: GoogleDriveSession): Promise<string> {
  const existing = await findByName(session, FOLDER_NAME, FOLDER_MIME, null);
  if (existing) return existing.id;

  const res = await driveFetch(session, `${DRIVE_API}?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME }),
  });
  const created = (await res.json()) as { id: string };
  return created.id;
}

export interface DriveDataFile {
  fileId: string;
  headRevisionId: string | undefined;
  content: string;
}

// Returns null when nothing has been saved yet (a brand-new sign-in) —
// the backend treats that as an empty dataset rather than an error.
export async function loadDataFile(session: GoogleDriveSession, folderId: string): Promise<DriveDataFile | null> {
  const existing = await findByName(session, DATA_FILE_NAME, "application/json", folderId);
  if (!existing) return null;

  const res = await driveFetch(session, `${DRIVE_API}/${existing.id}?alt=media`);
  const content = await res.text();
  return { fileId: existing.id, headRevisionId: existing.headRevisionId, content };
}

// Creates the data file the first time a signed-in Drive account writes
// anything, and returns its id + revision for subsequent saves.
export async function createDataFile(
  session: GoogleDriveSession,
  folderId: string,
  content: string,
): Promise<DriveDataFile> {
  const boundary = crypto.randomUUID();
  const metadata = { name: DATA_FILE_NAME, mimeType: "application/json", parents: [folderId] };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;

  const res = await driveFetch(
    session,
    `${DRIVE_UPLOAD_API}?uploadType=multipart&fields=id,headRevisionId`,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  const created = (await res.json()) as { id: string; headRevisionId?: string };
  return { fileId: created.id, headRevisionId: created.headRevisionId, content };
}

// Overwrites the data file's content. `expectedRevisionId` is the
// revision this write's caller last read — if the file has moved on
// since (another tab or device saved), the update is rejected with
// DriveConflictError instead of clobbering it.
export async function saveDataFile(
  session: GoogleDriveSession,
  fileId: string,
  content: string,
  expectedRevisionId: string | undefined,
): Promise<DriveDataFile> {
  if (expectedRevisionId) {
    const current = await driveFetch(session, `${DRIVE_API}/${fileId}?fields=headRevisionId`);
    const { headRevisionId } = (await current.json()) as { headRevisionId?: string };
    if (headRevisionId !== expectedRevisionId) {
      throw new DriveConflictError();
    }
  }

  const res = await driveFetch(
    session,
    `${DRIVE_UPLOAD_API}/${fileId}?uploadType=media&fields=headRevisionId`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: content,
    },
  );
  const updated = (await res.json()) as { headRevisionId?: string };
  return { fileId, headRevisionId: updated.headRevisionId, content };
}
