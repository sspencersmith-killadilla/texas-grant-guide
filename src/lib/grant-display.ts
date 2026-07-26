import type { Grant } from "./grants/types";

export function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  return Math.ceil((d - Date.now()) / 86_400_000);
}

export type Urgency = "closed" | "urgent" | "soon" | "open" | "rolling";

export function urgencyOf(grant: Grant): Urgency {
  const days = daysUntil(grant.closeDate);
  if (days === null) return "rolling";
  if (days < 0) return "closed";
  if (days <= 21) return "urgent";
  if (days <= 60) return "soon";
  return "open";
}

export function deadlineLabel(grant: Grant): string {
  const days = daysUntil(grant.closeDate);
  if (days === null) return grant.deadlineNote ? "Recurring program" : "Deadline varies";
  if (days < 0) return "Closed";
  if (days === 0) return "Due today";
  if (days === 1) return "1 day left";
  if (days <= 90) return `${days} days left`;
  return `Due ${formatDate(grant.closeDate)}`;
}

export function formatDate(iso?: string): string {
  if (!iso) return "Varies";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Varies";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function formatMoney(value?: number): string | null {
  if (!value || value <= 0) return null;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${value}`;
}

export function awardRange(grant: Grant): string | null {
  const floor = formatMoney(grant.awardFloor);
  const ceiling = formatMoney(grant.awardCeiling);
  if (floor && ceiling) return `${floor} – ${ceiling}`;
  if (ceiling) return `Up to ${ceiling}`;
  if (floor) return `From ${floor}`;
  const total = formatMoney(grant.estimatedFunding);
  return total ? `${total} available` : null;
}

export function matchLabel(grant: Grant): string {
  if (grant.matchNote) return grant.matchNote;
  if (grant.costSharing === true) return "Cost share / match required";
  if (grant.costSharing === false) return "No match required";
  return "Match requirement not stated";
}
