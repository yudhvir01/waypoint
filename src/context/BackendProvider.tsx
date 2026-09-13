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
import { DEFAULT_SUPABASE_CONFIG } from "../lib/env";
import { SupabaseBackend } from "../lib/backend/supabaseBackend";
import { GuestBackend } from "../lib/backend/guestBackend";
import { requestPersistentGuestStorage } from "../lib/backend/guestStore";
import { DriveBackend } from "../lib/backend/driveBackend";
import { GoogleDriveSession, restoreGoogleSignIn, signOutOfGoogle } from "../lib/backend/googleAuth";
import type { Backend } from "../lib/backend/types";

type Mode = "guest" | "supabase" | "drive";

const MODE_KEY = "waypoint.mode";

function loadMode(): Mode | null {
  const raw = localStorage.getItem(MODE_KEY);
  return raw === "guest" || raw === "supabase" || raw === "drive" ? raw : null;
}

interface BackendContextValue {
  // Which of guest / Supabase (eventually Drive) is active, or null
  // before anyone has picked one — the landing screen at /login.
  mode: Mode | null;
  // The one thing every page and hook is meant to talk to. Null until a
  // mode is chosen and (for Supabase) a session exists.
  backend: Backend | null;
  // True once we know whether there's a live session — false only during
  // the initial Supabase getSession() round trip.
  ready: boolean;
  // "Guest", or the signed-in email — what the UI shows for "who am I".
  ownerLabel: string | null;
  // Raw Supabase handles, for the login screen's own auth calls and
  // Settings' "connect a project to migrate into" flow. Present whenever
  // a Supabase project is configured, whether or not anyone's signed in.
  client: SupabaseClient | null;
  session: Session | null;
  supabaseConfig: SupabaseConfig | null;
  hasDefaultProject: boolean;
  isCustomSupabaseProject: boolean;

  loginAsGuest: () => void;
  // Points auth at a project (the baked-in default, or a bring-your-own
  // one) without signing in yet — the login screen then shows the
  // email/password form against whichever client this produces.
  selectSupabaseProject: (config: SupabaseConfig, custom: boolean) => void;
  // Called by /auth/google/callback once it's already exchanged the
  // authorization code for a session — this just adopts it as the app's
  // active identity and switches mode.
  completeGoogleSignIn: (session: GoogleDriveSession) => void;
  // Drops back to the picker without touching any stored data — guest
  // rows stay in IndexedDB, a Supabase session (if any) is left alone.
  returnToLanding: () => void;
  disconnectSupabaseProject: () => void;
  signOut: () => Promise<void>;
}

const BackendContext = createContext<BackendContextValue | undefined>(undefined);

export function BackendProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [mode, setModeState] = useState<Mode | null>(() => loadMode());
  const [customConfig, setCustomConfig] = useState<SupabaseConfig | null>(() => loadSupabaseConfig());
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [driveSession, setDriveSession] = useState<GoogleDriveSession | null>(null);
  const [driveAuthLoading, setDriveAuthLoading] = useState(true);
  const identityKey = useRef<string | null>(null);

  const supabaseConfig = customConfig ?? DEFAULT_SUPABASE_CONFIG;
  const client = useMemo(() => (supabaseConfig ? createSupabaseClient(supabaseConfig) : null), [supabaseConfig]);

  // Guest data lives entirely in this tab's memory of IndexedDB, so one
  // instance can be reused for the whole session instead of being
  // recreated (and re-opening the database) on every render.
  const guestBackend = useMemo(() => new GuestBackend(), []);

  useEffect(() => {
    if (mode !== "supabase" || !client) {
      setSession(null);
      setAuthLoading(false);
      return;
    }

    setAuthLoading(true);
    client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: subscription } = client.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, [client, mode]);

  // Rebuilds a Drive session from the refresh token stored in IndexedDB
  // on every load — the same role Supabase's own getSession() plays
  // above, so a Drive sign-in survives a reload the same way.
  useEffect(() => {
    if (mode !== "drive") {
      setDriveSession(null);
      setDriveAuthLoading(false);
      return;
    }
    let cancelled = false;
    setDriveAuthLoading(true);
    restoreGoogleSignIn().then((restored) => {
      if (cancelled) return;
      setDriveSession(restored);
      setDriveAuthLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  // Cached rows belong to whoever's data produced them. Switching between
  // guest and Supabase, or between two Supabase accounts on a shared
  // browser, has to drop the cache — otherwise the next identity briefly
  // renders the previous one's tracks from memory.
  useEffect(() => {
    const key =
      mode === "guest"
        ? "guest"
        : mode === "supabase" && session
          ? `supabase:${session.user.id}`
          : mode === "drive" && driveSession
            ? `drive:${driveSession.email}`
            : null;
    if (key !== identityKey.current) {
      if (identityKey.current !== null) queryClient.clear();
      identityKey.current = key;
    }
  }, [mode, session, driveSession, queryClient]);

  // Memoized so hooks that key off `backend` identity (queryFn closures,
  // effect deps) don't see a "new" backend — and refetch — on every
  // unrelated render.
  const backend: Backend | null = useMemo(() => {
    if (mode === "guest") return guestBackend;
    if (mode === "supabase" && client && session) return new SupabaseBackend(client, session.user.id);
    if (mode === "drive" && driveSession) return new DriveBackend(driveSession);
    return null;
  }, [mode, guestBackend, client, session, driveSession]);

  function loginAsGuest() {
    localStorage.setItem(MODE_KEY, "guest");
    setModeState("guest");
    void requestPersistentGuestStorage();
  }

  function selectSupabaseProject(config: SupabaseConfig, custom: boolean) {
    if (custom) {
      saveSupabaseConfig(config);
      setCustomConfig(config);
    }
    localStorage.setItem(MODE_KEY, "supabase");
    setModeState("supabase");
  }

  function completeGoogleSignIn(newSession: GoogleDriveSession) {
    setDriveSession(newSession);
    localStorage.setItem(MODE_KEY, "drive");
    setModeState("drive");
  }

  function returnToLanding() {
    localStorage.removeItem(MODE_KEY);
    setModeState(null);
  }

  function disconnectSupabaseProject() {
    clearSupabaseConfig();
    setCustomConfig(null);
    localStorage.removeItem(MODE_KEY);
    setModeState(null);
  }

  async function signOut() {
    if (mode === "supabase" && client) {
      await client.auth.signOut();
      return;
    }
    if (mode === "drive") {
      await signOutOfGoogle();
      setDriveSession(null);
    }
    returnToLanding();
  }

  const ownerLabel =
    mode === "guest"
      ? "Guest"
      : mode === "supabase"
        ? (session?.user.email ?? null)
        : mode === "drive"
          ? (driveSession?.email ?? null)
          : null;

  const value: BackendContextValue = {
    mode,
    backend,
    ready: mode === "guest" || (mode === "supabase" && !authLoading) || (mode === "drive" && !driveAuthLoading) || mode === null,
    ownerLabel,
    client,
    session,
    supabaseConfig,
    hasDefaultProject: DEFAULT_SUPABASE_CONFIG !== null,
    isCustomSupabaseProject: customConfig !== null,
    loginAsGuest,
    selectSupabaseProject,
    completeGoogleSignIn,
    returnToLanding,
    disconnectSupabaseProject,
    signOut,
  };

  return <BackendContext.Provider value={value}>{children}</BackendContext.Provider>;
}

export function useBackend() {
  const ctx = useContext(BackendContext);
  if (!ctx) throw new Error("useBackend must be used within a BackendProvider");
  return ctx;
}
