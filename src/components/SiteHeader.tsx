import { Link } from "@tanstack/react-router";
import { FileText, Landmark } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-sm bg-primary text-primary-foreground">
            <Landmark className="size-4" />
          </span>
          <span className="leading-tight">
            <span className="block font-display text-sm font-bold tracking-tight">Texas Municipal Grant Finder</span>
            <span className="block text-[11px] uppercase tracking-widest text-muted-foreground">
              State &amp; federal · for cities
            </span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            to="/"
            className="rounded-sm px-3 py-2 font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground [&.active]:text-foreground"
            activeOptions={{ exact: true }}
          >
            Find grants
          </Link>
          <Link
            to="/drafts"
            className="flex items-center gap-1.5 rounded-sm px-3 py-2 font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground [&.active]:text-foreground"
          >
            <FileText className="size-4" />
            My drafts
          </Link>
        </nav>
      </div>
    </header>
  );
}
