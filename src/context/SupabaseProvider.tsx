import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import {
  clearSupabaseConfig,
  loadSupabaseConfig,
  saveSupabaseConfig,
  type SupabaseConfig,
} from "../lib/supabaseConfig";
import { createSupabaseClient } from "../lib/supabaseClient";

interface SupabaseContextValue {
  config: SupabaseConfig | null;
  client: SupabaseClient | null;
  session: Session | null;
  authLoading: boolean;
  connect: (config: SupabaseConfig) => void;
  disconnect: () => void;
}

const SupabaseContext = createContext<SupabaseContextValue | undefined>(
  undefined,
);

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<SupabaseConfig | null>(() =>
    loadSupabaseConfig(),
  );
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const lastUserId = useRef<string | null>(null);

  const client = useMemo(
    () => (config ? createSupabaseClient(config) : null),
    [config],
  );

  useEffect(() => {
    if (!client) {
      setSession(null);
      setAuthLoading(false);
      return;
    }

    setAuthLoading(true);
    client.auth.getSession().then(({ data }) => {
      lastUserId.current = data.session?.user.id ?? null;
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: subscription } = client.auth.onAuthStateChange(
      (_event, newSession) => {
        // Cached rows belong to whoever was signed in when they were
        // fetched. Signing out — or signing in as somebody else on a
        // shared browser — has to drop them, or the next account briefly
        // renders the previous account's tracks from cache.
        const nextUserId = newSession?.user.id ?? null;
        if (nextUserId !== lastUserId.current) {
          lastUserId.current = nextUserId;
          queryClient.clear();
        }
        setSession(newSession);
      },
    );

    return () => subscription.subscription.unsubscribe();
  }, [client, queryClient]);

  const connect = (newConfig: SupabaseConfig) => {
    saveSupabaseConfig(newConfig);
    setConfig(newConfig);
  };

  const disconnect = () => {
    clearSupabaseConfig();
    queryClient.clear();
    lastUserId.current = null;
    setConfig(null);
    setSession(null);
  };

  return (
    <SupabaseContext.Provider
      value={{ config, client, session, authLoading, connect, disconnect }}
    >
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase() {
  const ctx = useContext(SupabaseContext);
  if (!ctx) {
    throw new Error("useSupabase must be used within a SupabaseProvider");
  }
  return ctx;
}
