import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, FileSignature, Loader2, Sparkles } from "lucide-react";

import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { getGrant, summarizeGrant } from "@/lib/grants.functions";
import { CATEGORY_LABELS } from "@/lib/grants/types";
import { awardRange, deadlineLabel, formatDate, matchLabel, urgencyOf } from "@/lib/grant-display";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/grants/$id/")({
  head: () => ({
    meta: [
      { title: "Grant details | Texas Municipal Grant Finder" },
      {
        name: "description",
        content: "A plain-English breakdown of what this grant funds, who can apply, what it costs your city and key dates.",
      },
      { property: "og:title", content: "Grant details | Texas Municipal Grant Finder" },
      {
        property: "og:description",
        content: "What this grant funds, who can apply, what it costs your city and key dates.",
      },
    ],
  }),
  component: GrantDetail,
});

function GrantDetail() {
  const { id } = useParams({ from: "/grants/$id/" });

  const grantQuery = useQuery({
    queryKey: ["grant", id],
    queryFn: () => getGrant({ data: { id } }),
    staleTime: 30 * 60 * 1000,
  });

  const grant = grantQuery.data;

  const summaryQuery = useQuery({
    queryKey: ["grant-summary", id],
    enabled: Boolean(grant?.description),
    staleTime: Infinity,
    retry: false,
    queryFn: () =>
      summarizeGrant({
        data: {
          id: grant!.id,
          title: grant!.title,
          agency: grant!.agency,
          description: grant!.description,
          eligibility: grant!.eligibility,
          closeDate: grant!.closeDate,
          openDate: grant!.openDate,
          deadlineNote: grant!.deadlineNote,
          matchNote: grant!.matchNote,
          costSharing: grant!.costSharing,
        },
      }),
  });

  if (grantQuery.isLoading) {
    return (
      <Shell>
        <div className="h-64 animate-pulse border border-border bg-card" />
      </Shell>
    );
  }

  if (!grant) {
    return (
      <Shell>
        <div className="border border-border bg-card p-10 text-center">
          <h1 className="text-xl font-semibold">Grant not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This opportunity may have been archived by the issuing agency.
          </p>
          <Button asChild className="mt-5 rounded-sm">
            <Link to="/">Back to all grants</Link>
          </Button>
        </div>
      </Shell>
    );
  }

  const urgency = urgencyOf(grant);
  const summary = summaryQuery.data;

  return (
    <Shell>
      <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All grants
      </Link>

      <div className="border border-border bg-card p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-widest">
          <span
            className={cn(
              "px-2 py-0.5",
              grant.source === "texas" ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground",
            )}
          >
            {grant.source === "texas" ? "Texas state" : "Federal"}
          </span>
          <span className="text-muted-foreground">{CATEGORY_LABELS[grant.category]}</span>
          <span
            className={cn(
              "px-2 py-0.5",
              urgency === "urgent"
                ? "bg-urgent text-urgent-foreground"
                : urgency === "soon"
                  ? "bg-soon text-soon-foreground"
                  : urgency === "open"
                    ? "bg-open text-open-foreground"
                    : "bg-secondary text-secondary-foreground",
            )}
          >
            {deadlineLabel(grant)}
          </span>
        </div>

        <h1 className="mt-4 text-2xl font-bold leading-tight sm:text-3xl">{grant.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {grant.agency}
          {grant.number ? ` · ${grant.number}` : ""}
        </p>

        <dl className="mt-6 grid gap-4 border-y border-border py-5 sm:grid-cols-4">
          <Fact label="Award" value={awardRange(grant) ?? "Varies"} />
          <Fact label="Opens" value={formatDate(grant.openDate)} />
          <Fact label="Closes" value={grant.closeDate ? formatDate(grant.closeDate) : "Varies by cycle"} />
          <Fact label="Match" value={matchLabel(grant)} />
        </dl>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild className="rounded-sm bg-accent text-accent-foreground hover:bg-accent/90">
            <Link to="/grants/$id/draft" params={{ id: grant.id }}>
              <FileSignature className="size-4" /> Start my draft application
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-sm">
            <a href={grant.url} target="_blank" rel="noopener noreferrer">
              Official listing <ExternalLink className="size-4" />
            </a>
          </Button>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="size-4 text-accent" /> In plain English
        </h2>

        {summaryQuery.isLoading ? (
          <p className="mt-4 flex items-center gap-2 border border-border bg-card p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Reading the official program text and writing a plain-English
            summary…
          </p>
        ) : summaryQuery.isError ? (
          <p className="mt-4 border border-border bg-card p-6 text-sm text-muted-foreground">
            The plain-English summary is unavailable right now. The official description is below.
          </p>
        ) : summary ? (
          <div className="mt-4 space-y-4">
            <p className="border-l-2 border-accent bg-surface p-4 text-base font-medium">{summary.headline}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Panel title="What this funds" body={summary.whatItFunds} />
              <Panel title="Who can apply" body={summary.whoCanApply} />
              <Panel title="What it costs you" body={summary.whatItCostsYou} />
              <Panel title="What you'll need" body={summary.whatYoullNeed} />
            </div>

            {summary.goodFitIf.length > 0 ? (
              <div className="border border-border bg-card p-5">
                <h3 className="text-sm font-semibold">Good fit if your city…</h3>
                <ul className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                  {summary.goodFitIf.map((item, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1.5 size-1.5 shrink-0 bg-accent" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {summary.timeline.length > 0 ? (
              <div className="border border-border bg-card p-5">
                <h3 className="text-sm font-semibold">Timeline</h3>
                <ol className="mt-4 space-y-0">
                  {summary.timeline.map((step, i) => (
                    <li key={i} className="relative flex gap-4 pb-5 last:pb-0">
                      <div className="flex flex-col items-center">
                        <span className="mt-1 size-2.5 shrink-0 rounded-full bg-accent" />
                        {i < summary.timeline.length - 1 ? <span className="w-px flex-1 bg-border" /> : null}
                      </div>
                      <div className="-mt-0.5">
                        <p className="text-sm font-semibold">{step.label}</p>
                        <p className="text-xs font-medium uppercase tracking-wide text-accent">{step.date}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{step.note}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {grant.description ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Official program description</h2>
          <p className="mt-3 whitespace-pre-line border border-border bg-card p-5 text-sm leading-relaxed text-muted-foreground">
            {grant.description}
          </p>
          {grant.eligibility ? (
            <>
              <h3 className="mt-6 text-sm font-semibold">Eligibility (as published)</h3>
              <p className="mt-2 border border-border bg-card p-5 text-sm leading-relaxed text-muted-foreground">
                {grant.eligibility}
              </p>
            </>
          ) : null}
          {grant.contact ? <p className="mt-4 text-xs text-muted-foreground">Contact: {grant.contact}</p> : null}
          {grant.deadlineNote ? (
            <p className="mt-2 text-xs text-muted-foreground">Deadline note: {grant.deadlineNote}</p>
          ) : null}
        </section>
      ) : null}

      <p className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
        Last checked {formatDate(grant.lastChecked)}. Summaries are AI-generated from official text and can miss details —
        confirm everything on the agency page before you apply.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-10">{children}</main>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}

function Panel({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-border bg-card p-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
