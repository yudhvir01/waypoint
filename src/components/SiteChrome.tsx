import { Link } from "react-router-dom";
import { Logo } from "./Logo";

// The public site's shared top bar and footer — used by the landing page
// and the guide so moving between them feels like one website.
export function SiteHeader() {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 pr-32">
      <Link to="/" aria-label="Waypoint home">
        <Logo size={34} />
      </Link>
      <nav className="flex items-center gap-1 text-sm sm:gap-3">
        <Link to="/guide" className="hidden rounded-md px-3 py-2 hover:text-primary sm:block">Guide</Link>
        <Link to="/privacy" className="hidden rounded-md px-3 py-2 hover:text-primary md:block">Privacy</Link>
        <Link to="/terms" className="hidden rounded-md px-3 py-2 hover:text-primary md:block">Terms</Link>
        <Link to="/login" className="rounded-md px-3 py-2 font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="px-6 py-8 text-center text-xs text-muted-foreground">
      <div className="flex justify-center gap-5">
        <Link to="/privacy" className="hover:underline">Privacy Policy</Link>
        <Link to="/terms" className="hover:underline">Terms of Service</Link>
        <Link to="/guide" className="hover:underline">Guide</Link>
      </div>
      <p className="mt-2">© {new Date().getFullYear()} Waypoint</p>
    </footer>
  );
}
