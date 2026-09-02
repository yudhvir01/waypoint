const STORAGE_KEY = "waypoint.supabaseConfig";

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function loadSupabaseConfig(): SupabaseConfig | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.url === "string" && typeof parsed.anonKey === "string") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveSupabaseConfig(config: SupabaseConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearSupabaseConfig() {
  localStorage.removeItem(STORAGE_KEY);
}
