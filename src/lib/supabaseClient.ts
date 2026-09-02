import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SupabaseConfig } from "./supabaseConfig";

export function createSupabaseClient(config: SupabaseConfig): SupabaseClient {
  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}
