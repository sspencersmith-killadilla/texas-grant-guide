export type GrantSource = "federal" | "texas";

export const CATEGORIES = [
  "water",
  "transportation",
  "public-safety",
  "parks",
  "broadband",
  "housing",
  "emergency",
  "energy",
  "community",
  "culture",
  "tourism",
  "other",
] as const;

export type GrantCategory = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<GrantCategory, string> = {
  water: "Water & Wastewater",
  transportation: "Transportation",
  "public-safety": "Public Safety",
  parks: "Parks & Recreation",
  broadband: "Broadband",
  housing: "Housing",
  emergency: "Emergency Management",
  energy: "Energy & Air Quality",
  community: "Community Development",
  culture: "Libraries, Arts & Museums",
  tourism: "Tourism & Travel",
  other: "Other",
};


export interface Grant {
  id: string;
  source: GrantSource;
  title: string;
  agency: string;
  number?: string;
  category: GrantCategory;
  status?: "posted" | "forecasted";
  eligibilityCodes?: string[];
  openDate?: string;
  closeDate?: string;
  deadlineNote?: string;
  estimatedFunding?: number;
  awardCeiling?: number;
  awardFloor?: number;
  costSharing?: boolean;
  matchNote?: string;
  url: string;
  description: string;
  eligibility?: string;
  contact?: string;
  lastChecked: string;
}


export interface PlainSummary {
  headline: string;
  whatItFunds: string;
  whoCanApply: string;
  whatItCostsYou: string;
  whatYoullNeed: string;
  timeline: { label: string; date: string; note: string }[];
  goodFitIf: string[];
}
