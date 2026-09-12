import { Navigate, Outlet } from "react-router-dom";
import { useBackend } from "../context/BackendProvider";

// Gates every page that needs actual data behind having picked a mode
// (guest, or a Supabase project with a live session) — sends anyone else
// to the picker at /login instead of rendering a page with nothing to
// show.
export function RequireAuth() {
  const { ready, backend } = useBackend();
  if (!ready) return null;
  if (!backend) return <Navigate to="/login" replace />;
  return <Outlet />;
}

// The inverse: once a mode is active, /login has nothing left to do.
export function RedirectIfAuthed() {
  const { ready, backend } = useBackend();
  if (!ready) return null;
  if (backend) return <Navigate to="/" replace />;
  return <Outlet />;
}
