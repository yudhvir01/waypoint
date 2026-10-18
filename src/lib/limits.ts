// The longest text the database accepts in each field (the "Length
// limits" section of supabase/setup.sql). Far beyond anything typed by
// hand; they exist so one account can't fill the database.
export const LIMITS = {
  trackName: 200,
  trackDescription: 1000,
  topicTitle: 500,
  taskTitle: 1000,
  noteTitle: 500,
  noteContent: 1_000_000,
  cardSide: 5000,
} as const;
