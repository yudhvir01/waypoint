import { Navigate, Outlet } from "react-router-dom";
import { useSupabase } from "../context/SupabaseProvider";

export function RequireConfig() {
  const { config } = useSupabase();
  if (!config) return <Navigate to="/connect" replace />;
  return <Outlet />;
}

export function RequireAuth() {
  const { session, authLoading } = useSupabase();
  if (authLoading) return null;
  if (!session) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function RedirectIfAuthed() {
  const { session, authLoading } = useSupabase();
  if (authLoading) return null;
  if (session) return <Navigate to="/" replace />;
  return <Outlet />;
}
