import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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
  const [config, setConfig] = useState<SupabaseConfig | null>(() =>
    loadSupabaseConfig(),
  );
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

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
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: subscription } = client.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      },
    );

    return () => subscription.subscription.unsubscribe();
  }, [client]);

  const connect = (newConfig: SupabaseConfig) => {
    saveSupabaseConfig(newConfig);
    setConfig(newConfig);
  };

  const disconnect = () => {
    clearSupabaseConfig();
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
