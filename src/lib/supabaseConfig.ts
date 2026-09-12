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

// Accepts either a bare project ref (e.g. "qmhmosjgokreigmsaklx") or a full
// project URL (e.g. "https://qmhmosjgokreigmsaklx.supabase.co") pasted in
// by mistake, and normalizes either into just the ref.
export function extractProjectRef(input: string): string | null {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i);
  if (urlMatch) return urlMatch[1].toLowerCase();
  if (/^[a-z0-9]{10,40}$/i.test(trimmed)) return trimmed.toLowerCase();
  return null;
}
