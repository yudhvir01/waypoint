import { useSupabase } from "../context/SupabaseProvider";
import { Logo } from "../components/Logo";

export function Dashboard() {
  const { session, client } = useSupabase();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <Logo size={28} />
        <button
          type="button"
          onClick={() => client?.auth.signOut()}
          className="text-sm text-muted-foreground hover:underline"
        >
          Sign out
        </button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Signed in as {session?.user.email}. Tracks, topics, and the Focus Now
        list land here in Phase 2.
      </p>
    </div>
  );
}
