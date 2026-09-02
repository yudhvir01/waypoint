import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SupabaseProvider } from "./context/SupabaseProvider";
import { ThemeProvider } from "./context/ThemeProvider";
import { ThemeToggle } from "./components/ThemeToggle";
import { RequireAuth, RequireConfig, RedirectIfAuthed } from "./components/RequireConfig";
import { Connect } from "./pages/Connect";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { TrackDetail } from "./pages/TrackDetail";
import { Settings } from "./pages/Settings";
import { Guide } from "./pages/Guide";

const queryClient = new QueryClient();

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <SupabaseProvider>
          <BrowserRouter>
            <div className="fixed right-4 top-4 z-50">
              <ThemeToggle />
            </div>
            <Routes>
              <Route path="/guide" element={<Guide />} />
              <Route path="/connect" element={<Connect />} />
              <Route element={<RequireConfig />}>
                <Route element={<RedirectIfAuthed />}>
                  <Route path="/login" element={<Login />} />
                </Route>
                <Route element={<RequireAuth />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/tracks/:trackId" element={<TrackDetail />} />
                  <Route path="/settings" element={<Settings />} />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
        </SupabaseProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
