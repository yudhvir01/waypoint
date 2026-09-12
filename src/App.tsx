import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Analytics } from "@vercel/analytics/react";
import { SupabaseProvider } from "./context/SupabaseProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ThemeProvider } from "./context/ThemeProvider";
import { ThemeToggle } from "./components/ThemeToggle";
import { RequireAuth, RequireConfig, RedirectIfAuthed } from "./components/RequireConfig";
import { Connect } from "./pages/Connect";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { TrackDetail } from "./pages/TrackDetail";
import { Settings } from "./pages/Settings";
import { Archived } from "./pages/Archived";
// The guide bundles four Markdown chapters plus the Markdown renderer.
// Loading it lazily keeps roughly half a megabyte out of the entry chunk
// that every signed-in page has to download first.
const Guide = lazy(() => import("./pages/Guide").then((m) => ({ default: m.Guide })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Every navigation re-rendering AppShell refetched the sidebar and
      // its progress counts. Holding results briefly collapses that into
      // one request per minute rather than one per route change.
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      // A wrong anon key or a missing table is not worth three retries —
      // only transient failures are.
      retry: (failureCount, error) => {
        const status = (error as { status?: number } | null)?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: { retry: 0 },
  },
});

function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <SupabaseProvider>
            <BrowserRouter>
              <div className="fixed right-4 top-4 z-50">
                <ThemeToggle />
              </div>
              <Routes>
                <Route
                  path="/guide"
                  element={
                    <Suspense fallback={null}>
                      <Guide />
                    </Suspense>
                  }
                />
                <Route path="/connect" element={<Connect />} />
                <Route element={<RequireConfig />}>
                  <Route element={<RedirectIfAuthed />}>
                    <Route path="/login" element={<Login />} />
                  </Route>
                  <Route element={<RequireAuth />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/tracks/:trackId" element={<TrackDetail />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/archived" element={<Archived />} />
                  </Route>
                </Route>
              </Routes>
            </BrowserRouter>
            <Analytics />
          </SupabaseProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
