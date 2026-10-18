import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../components/AppShell";
import { useBackend } from "../context/BackendProvider";
import { ensureTodo } from "../lib/inbox";

// /todo: the To do list, made on the spot if nothing has been added yet.
export function TodoRedirect() {
  const { backend } = useBackend();
  const { data, isError } = useQuery({
    queryKey: ["todoTrack"],
    enabled: !!backend,
    gcTime: 0,
    queryFn: () => ensureTodo(backend!),
  });

  if (data) return <Navigate to={`/tracks/${data.trackId}`} replace />;
  return (
    <AppShell>
      <p className={`text-sm ${isError ? "text-destructive" : "text-muted-foreground"}`}>
        {isError ? "Couldn't open your To do list. Check your connection and reload." : "Opening your To do list…"}
      </p>
    </AppShell>
  );
}
