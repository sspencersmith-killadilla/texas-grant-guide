import type { GrantCategory } from "./grants/types";
import { citationSentence, type HudPlaceFinding } from "./hud";

export type MatchCapacity = "" | "none" | "under-50k" | "50k-250k" | "250k-1m" | "over-1m";
export type StaffCapacity = "" | "none" | "limited" | "dedicated";
export type FrontCosts = "" | "yes" | "no" | "unsure";
export type Governance = "" | "general-law" | "home-rule";

export interface CityProfile {
  cityName: string;
  county: string;
  population: number | null;
  governance: Governance;
  services: string[];
  designations: string[];
  priorities: GrantCategory[];
  capitalProjects: string;
  matchCapacity: MatchCapacity;
  staffCapacity: StaffCapacity;
  canFrontCosts: FrontCosts;
  keywords: string[];
  uei: string;
  /** Citywide HUD low/mod and Opportunity Zone check, when the city has run one. */
  hudFindings: HudPlaceFinding | null;
  updatedAt: string;
}


export const SERVICE_OPTIONS: { id: string; label: string; categories: GrantCategory[] }[] = [
  { id: "water", label: "Drinking water system", categories: ["water"] },
  { id: "wastewater", label: "Wastewater / sewer system", categories: ["water"] },
  { id: "stormwater", label: "Stormwater / drainage", categories: ["water", "emergency"] },
  { id: "streets", label: "Streets and bridges", categories: ["transportation"] },
  { id: "transit", label: "Public transit", categories: ["transportation"] },
  { id: "airport", label: "Municipal airport", categories: ["transportation"] },
  { id: "police", label: "Police department", categories: ["public-safety"] },
  { id: "fire", label: "Fire department", categories: ["public-safety", "emergency"] },
  { id: "ems", label: "EMS / ambulance", categories: ["public-safety", "emergency"] },
  { id: "emergency", label: "Emergency management office", categories: ["emergency"] },
  { id: "parks", label: "Parks and recreation", categories: ["parks"] },
  { id: "library", label: "Public library", categories: ["culture"] },
  { id: "museum", label: "Museum or cultural center", categories: ["culture"] },
  { id: "arts", label: "Arts programming or arts board", categories: ["culture"] },
  { id: "tourism", label: "Tourism / visitor promotion", categories: ["tourism"] },
  { id: "downtown", label: "Downtown or Main Street program", categories: ["community", "tourism"] },
  { id: "housing", label: "Housing or code enforcement program", categories: ["housing"] },
  { id: "utilityElectric", label: "Municipal electric or gas utility", categories: ["energy"] },
  { id: "broadband", label: "Broadband or IT infrastructure", categories: ["broadband"] },
  { id: "econdev", label: "Economic development corporation (4A/4B)", categories: ["community"] },
];

export const DESIGNATION_OPTIONS: { id: string; label: string; keywords: string[] }[] = [
  { id: "rural", label: "Rural community", keywords: ["rural", "non-urbanized", "nonmetropolitan"] },
  { id: "lmi", label: "Majority low- and moderate-income", keywords: ["low- and moderate-income", "low-income", "lmi", "disadvantaged"] },
  { id: "disadvantaged", label: "Federally disadvantaged community (CEJST)", keywords: ["disadvantaged community", "justice40", "environmental justice"] },
  { id: "colonia", label: "Has colonias", keywords: ["colonia"] },
  { id: "border", label: "Texas–Mexico border region", keywords: ["border", "binational"] },
  { id: "mainstreet", label: "Texas Main Street city", keywords: ["main street", "downtown revitalization"] },
  { id: "clg", label: "Certified Local Government", keywords: ["certified local government", "historic preservation"] },
  { id: "mpo", label: "Inside an MPO planning area", keywords: ["metropolitan planning organization", "mpo", "urbanized"] },
  { id: "disaster", label: "Recent federally declared disaster", keywords: ["disaster declaration", "presidentially declared", "recovery"] },
  { id: "opportunityZone", label: "Has an Opportunity Zone", keywords: ["opportunity zone", "distressed"] },
  { id: "tribal", label: "Adjacent to tribal lands", keywords: ["tribal"] },
  { id: "coastal", label: "Coastal / Gulf watershed", keywords: ["coastal", "gulf", "estuary"] },
];

export const MATCH_CAPACITY_LABELS: Record<Exclude<MatchCapacity, "">, string> = {
  none: "No cash match available",
  "under-50k": "Up to $50,000",
  "50k-250k": "$50,000 – $250,000",
  "250k-1m": "$250,000 – $1 million",
  "over-1m": "More than $1 million",
};

export const MATCH_CAPACITY_AMOUNT: Record<Exclude<MatchCapacity, "">, number> = {
  none: 0,
  "under-50k": 50_000,
  "50k-250k": 250_000,
  "250k-1m": 1_000_000,
  "over-1m": 5_000_000,
};

export const STAFF_CAPACITY_LABELS: Record<Exclude<StaffCapacity, "">, string> = {
  none: "No one is assigned to grants",
  limited: "Someone handles grants part-time",
  dedicated: "We have a grant coordinator or consultant",
};

export const FRONT_COSTS_LABELS: Record<Exclude<FrontCosts, "">, string> = {
  yes: "Yes, we can pay first and be reimbursed",
  no: "No, we need funds up front",
  unsure: "Not sure",
};

export const EMPTY_PROFILE: CityProfile = {
  cityName: "",
  county: "",
  population: null,
  governance: "",
  services: [],
  designations: [],
  priorities: [],
  capitalProjects: "",
  matchCapacity: "",
  staffCapacity: "",
  canFrontCosts: "",
  keywords: [],
  uei: "",
  hudFindings: null,
  updatedAt: "",
};


const KEY = "muniCityProfile.v1";
const VISIT_KEY = "muniLastVisit.v1";

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadProfile(): CityProfile | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CityProfile>;
    return { ...EMPTY_PROFILE, ...parsed };
  } catch {
    return null;
  }
}

export function saveProfile(profile: CityProfile): CityProfile {
  const next = { ...profile, updatedAt: new Date().toISOString() };
  if (isBrowser()) {
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("muni-profile-changed"));
  }
  return next;
}

export function clearProfile() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent("muni-profile-changed"));
}

export function hasUsableProfile(profile: CityProfile | null): profile is CityProfile {
  return Boolean(profile && profile.cityName.trim() && (profile.services.length > 0 || profile.population));
}

/** Timestamp of the previous visit, used for the "new since you were last here" view. */
export function readLastVisit(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(VISIT_KEY);
}

export function markVisit() {
  if (!isBrowser()) return;
  window.localStorage.setItem(VISIT_KEY, new Date().toISOString());
}

export function profileSummaryText(profile: CityProfile): string {
  const services = SERVICE_OPTIONS.filter((s) => profile.services.includes(s.id)).map((s) => s.label);
  const designations = DESIGNATION_OPTIONS.filter((d) => profile.designations.includes(d.id)).map((d) => d.label);
  const lines = [
    `City: ${profile.cityName || "unknown"}${profile.county ? `, ${profile.county} County, Texas` : ", Texas"}`,
    `Population: ${profile.population ? profile.population.toLocaleString() : "unknown"}`,
    profile.governance ? `Governance: ${profile.governance === "home-rule" ? "home-rule city" : "general-law city"}` : "",
    services.length ? `Services operated: ${services.join(", ")}` : "",
    designations.length ? `Designations: ${designations.join(", ")}` : "",
    profile.capitalProjects ? `Current priorities and capital projects: ${profile.capitalProjects}` : "",
    profile.matchCapacity ? `Local match capacity: ${MATCH_CAPACITY_LABELS[profile.matchCapacity]}` : "",
    profile.staffCapacity ? `Grant staffing: ${STAFF_CAPACITY_LABELS[profile.staffCapacity]}` : "",
    profile.canFrontCosts ? `Can front costs for reimbursement: ${FRONT_COSTS_LABELS[profile.canFrontCosts]}` : "",
    profile.uei ? `SAM.gov UEI: ${profile.uei}` : "",
    profile.hudFindings ? `Verified HUD data: ${citationSentence(profile.hudFindings)}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

