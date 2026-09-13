import { openDB, type DBSchema, type IDBPDatabase } from "idb";

// The one thing that has to survive a reload: the refresh token. Kept in
// its own tiny database rather than alongside guest data, since signing
// into Drive and using guest mode are unrelated — someone could do both
// in the same browser at different times.
interface DriveAuthDB extends DBSchema {
  session: { key: string; value: { email: string; refreshToken: string } };
}

const SESSION_KEY = "current";

let dbPromise: Promise<IDBPDatabase<DriveAuthDB>> | null = null;

function getDB(): Promise<IDBPDatabase<DriveAuthDB>> {
  if (!dbPromise) {
    dbPromise = openDB<DriveAuthDB>("waypoint-drive-auth", 1, {
      upgrade(db) {
        db.createObjectStore("session");
      },
    });
  }
  return dbPromise;
}

export async function saveDriveSession(email: string, refreshToken: string): Promise<void> {
  const db = await getDB();
  await db.put("session", { email, refreshToken }, SESSION_KEY);
}

export async function loadDriveSession(): Promise<{ email: string; refreshToken: string } | null> {
  const db = await getDB();
  return (await db.get("session", SESSION_KEY)) ?? null;
}

export async function clearDriveSession(): Promise<void> {
  const db = await getDB();
  await db.delete("session", SESSION_KEY);
}
