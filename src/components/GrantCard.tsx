import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowUpRight, CalendarClock, Coins } from "lucide-react";

import type { Grant } from "@/lib/grants/types";
import { CATEGORY_LABELS } from "@/lib/grants/types";
import { FIT_LABELS, type FitResult } from "@/lib/grants/fit";
import { awardRange, deadlineLabel, formatDate, matchLabel, urgencyOf } from "@/lib/grant-display";
import { cn } from "@/lib/utils";

const URGENCY_CLASSES: Record<string, string> = {
  urgent: "bg-urgent text-urgent-foreground",
  soon: "bg-soon text-soon-foreground",
  open: "bg-open text-open-foreground",
  rolling: "bg-secondary text-secondary-foreground",
  closed: "bg-muted text-muted-foreground",
};

const FIT_CLASSES: Record<string, string> = {
  strong: "border-open text-open",
  possible: "border-border text-muted-foreground",
  weak: "border-border text-muted-foreground",
  unlikely: "border-urgent/50 text-urgent",
};

export function GrantCard({ grant, fit }: { grant: Grant; fit?: FitResult | null }) {
  const urgency = urgencyOf(grant);
  const money = awardRange(grant);

  return (
    <Link
      to="/grants/$id"
      params={{ id: grant.id }}
      className="group block border border-border bg-card p-5 transition-colors hover:border-accent"
    >
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-widest">
        <span
          className={cn(
            "px-2 py-0.5",
            grant.source === "texas" ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground",
          )}
        >
          {grant.source === "texas" ? "Texas" : "Federal"}
        </span>
        <span className="text-muted-foreground">{CATEGORY_LABELS[grant.category]}</span>
        {grant.status === "forecasted" ? (
          <span className="border border-border px-2 py-0.5 text-muted-foreground">Forecasted</span>
        ) : null}
        <span className={cn("ml-auto px-2 py-0.5", URGENCY_CLASSES[urgency])}>{deadlineLabel(grant)}</span>
      </div>

      <h3 className="mt-3 text-base font-semibold leading-snug text-foreground group-hover:text-accent">
        {grant.title}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">{grant.agency}</p>

      {fit ? (
        <div className="mt-3 space-y-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-widest",
              FIT_CLASSES[fit.level],
            )}
          >
            {fit.level === "unlikely" ? <AlertTriangle className="size-3" /> : null}
            {FIT_LABELS[fit.level]} · {fit.score}
          </span>
          {(fit.blockers[0] ?? fit.reasons[0]) ? (
            <p className={cn("text-xs", fit.blockers[0] ? "text-urgent" : "text-muted-foreground")}>
              {fit.blockers[0] ?? fit.reasons[0]}
            </p>
          ) : null}
        </div>
      ) : null}

      <dl className="mt-4 grid gap-2 border-t border-border pt-3 text-xs text-muted-foreground sm:grid-cols-3">
        <div className="flex items-start gap-1.5">
          <Coins className="mt-0.5 size-3.5 shrink-0" />
          <span>{money ?? "Award amount varies"}</span>
        </div>
        <div className="flex items-start gap-1.5">
          <CalendarClock className="mt-0.5 size-3.5 shrink-0" />
          <span>{grant.closeDate ? `Closes ${formatDate(grant.closeDate)}` : "Check agency cycle"}</span>
        </div>
        <div className="flex items-start gap-1.5">
          <ArrowUpRight className="mt-0.5 size-3.5 shrink-0" />
          <span className="line-clamp-2">{matchLabel(grant)}</span>
        </div>
      </dl>
    </Link>
  );
}
