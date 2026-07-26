import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, Search } from "lucide-react";

import { SiteHeader } from "@/components/SiteHeader";
import { GrantCard } from "@/components/GrantCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { listGrants } from "@/lib/grants.functions";
import { CATEGORIES, CATEGORY_LABELS, type GrantCategory } from "@/lib/grants/types";
import { daysUntil, formatDate } from "@/lib/grant-display";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Texas Municipal Grant Finder | Grants Your City Can Apply For" },
      {
        name: "description",
        content:
          "Search state of Texas and federal grants open to municipalities, read plain-English summaries and deadlines, and build a first-draft application.",
      },
      { property: "og:title", content: "Texas Municipal Grant Finder" },
      {
        property: "og:description",
        content: "Grants Texas cities can apply for, explained in plain English, with a first-draft application generator.",
      },
    ],
  }),
  component: Index,
});

type SourceFilter = "all" | "federal" | "texas";
type DeadlineFilter = "all" | "30" | "60" | "90";

function Index() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["grants"],
    queryFn: () => listGrants(),
    staleTime: 10 * 60 * 1000,
  });

  const [search, setSearch] = useState("");
  const [source, setSource] = useState<SourceFilter>("all");
  const [category, setCategory] = useState<GrantCategory | "all">("all");
  const [deadline, setDeadline] = useState<DeadlineFilter>("all");

  const grants = data?.grants ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return grants
      .filter((g) => (source === "all" ? true : g.source === source))
      .filter((g) => (category === "all" ? true : g.category === category))
      .filter((g) => {
        if (deadline === "all") return true;
        const days = daysUntil(g.closeDate);
        if (days === null) return false;
        return days >= 0 && days <= Number(deadline);
      })
      .filter((g) => {
        const days = daysUntil(g.closeDate);
        return days === null || days >= 0;
      })
      .filter((g) => !q || `${g.title} ${g.agency} ${g.number ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => {
        const da = daysUntil(a.closeDate);
        const db = daysUntil(b.closeDate);
        if (da === null && db === null) return a.title.localeCompare(b.title);
        if (da === null) return 1;
        if (db === null) return -1;
        return da - db;
      });
  }, [grants, search, source, category, deadline]);

  const counts = useMemo(
    () => ({
      texas: grants.filter((g) => g.source === "texas").length,
      federal: grants.filter((g) => g.source === "federal").length,
    }),
    [grants],
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="border-b border-border bg-surface hairline-grid">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">For Texas cities and towns</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-extrabold leading-[1.05] sm:text-5xl">
            Grant money your city qualifies for, explained without the jargon.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground">
            Search {counts.federal + counts.texas || "hundreds of"} open federal and state of Texas programs where
            municipalities are eligible applicants. Read a plain-English summary and timeline, then answer eight
            questions to generate a first-draft application you can download as Word or PDF.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by keyword, agency or opportunity number"
                className="h-11 rounded-sm border-border bg-card pl-9"
                aria-label="Search grants"
              />
            </div>
            <Button variant="outline" className="h-11 rounded-sm" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? <Loader2 className="size-4 animate-spin" /> : null}
              Refresh listings
            </Button>
          </div>
          {data?.federalError ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-urgent">
              <AlertTriangle className="size-4" /> Federal listings could not be refreshed right now ({data.federalError}).
              Texas programs are still shown.
            </p>
          ) : null}
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          <aside className="space-y-6">
            <FilterGroup label="Source">
              <FilterChip active={source === "all"} onClick={() => setSource("all")}>
                All sources
              </FilterChip>
              <FilterChip active={source === "texas"} onClick={() => setSource("texas")}>
                Texas state ({counts.texas})
              </FilterChip>
              <FilterChip active={source === "federal"} onClick={() => setSource("federal")}>
                Federal ({counts.federal})
              </FilterChip>
            </FilterGroup>

            <FilterGroup label="Deadline">
              {(
                [
                  ["all", "Any deadline"],
                  ["30", "Next 30 days"],
                  ["60", "Next 60 days"],
                  ["90", "Next 90 days"],
                ] as [DeadlineFilter, string][]
              ).map(([value, label]) => (
                <FilterChip key={value} active={deadline === value} onClick={() => setDeadline(value)}>
                  {label}
                </FilterChip>
              ))}
            </FilterGroup>

            <FilterGroup label="Category">
              <FilterChip active={category === "all"} onClick={() => setCategory("all")}>
                All categories
              </FilterChip>
              {CATEGORIES.map((c) => (
                <FilterChip key={c} active={category === c} onClick={() => setCategory(c)}>
                  {CATEGORY_LABELS[c]}
                </FilterChip>
              ))}
            </FilterGroup>
          </aside>

          <div>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-3">
              <h2 className="text-lg font-semibold">
                {isLoading ? "Loading grants…" : `${filtered.length} open opportunit${filtered.length === 1 ? "y" : "ies"}`}
              </h2>
              <p className="text-xs text-muted-foreground">
                Federal data from Grants.gov · last checked {formatDate(new Date().toISOString())}
              </p>
            </div>

            {isLoading ? (
              <div className="grid gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-40 animate-pulse border border-border bg-card" />
                ))}
              </div>
            ) : isError ? (
              <p className="border border-urgent/40 bg-card p-6 text-sm">
                Something went wrong loading grants. <button className="underline" onClick={() => refetch()}>Try again</button>.
              </p>
            ) : filtered.length === 0 ? (
              <div className="border border-border bg-card p-10 text-center">
                <p className="font-semibold">No grants match those filters.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try widening the deadline window or clearing the category filter.
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {filtered.map((grant) => (
                  <GrantCard key={grant.id} grant={grant} />
                ))}
              </div>
            )}

            <p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
              Always confirm eligibility, deadlines and match requirements on the official program page before applying.
              Drafts you create are stored only in this browser — see{" "}
              <Link to="/drafts" className="underline">
                My drafts
              </Link>
              .
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</h3>
      <div className="flex flex-wrap gap-1.5 lg:flex-col lg:items-start">{children}</div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full border px-2.5 py-1.5 text-left text-xs font-medium transition-colors",
        active
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border bg-card text-muted-foreground hover:border-accent/50 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
