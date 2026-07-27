import {
  DESIGNATION_OPTIONS,
  MATCH_CAPACITY_AMOUNT,
  SERVICE_OPTIONS,
  type CityProfile,
} from "../city-profile";
import { daysUntil } from "../grant-display";
import { CATEGORY_LABELS, type Grant } from "./types";

export type FitLevel = "strong" | "possible" | "weak" | "unlikely";

export interface FitResult {
  score: number;
  level: FitLevel;
  reasons: string[];
  blockers: string[];
}

export const FIT_LABELS: Record<FitLevel, string> = {
  strong: "Strong fit",
  possible: "Possible fit",
  weak: "Weak fit",
  unlikely: "Likely not eligible",
};

const NEUTRAL: FitResult = { score: 50, level: "possible", reasons: [], blockers: [] };

/** Population caps published in eligibility text, e.g. "population of less than 50,000". */
function findPopulationCap(text: string): number | null {
  const patterns = [
    /population[^.]{0,40}?(?:of\s+)?(?:less than|fewer than|under|below|not exceeding|up to|at or below)\s+([\d,]{3,12})/i,
    /(?:communities|cities|municipalities)[^.]{0,40}?(?:with|of)\s+(?:a\s+)?population[^.]{0,20}?([\d,]{3,12})\s+or\s+(?:fewer|less)/i,
  ];
  for (const re of patterns) {
    const m = re.exec(text);
    if (m) {
      const n = Number(m[1].replace(/,/g, ""));
      if (Number.isFinite(n) && n >= 500) return n;
    }
  }
  return null;
}

function findPopulationFloor(text: string): number | null {
  const m = /population[^.]{0,40}?(?:of\s+)?(?:greater than|more than|at least|over|exceeding)\s+([\d,]{3,12})/i.exec(text);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) && n >= 500 ? n : null;
}

const EXCLUSIVE_PHRASES: { re: RegExp; reason: string }[] = [
  { re: /only\s+(?:federally recognized\s+)?(?:indian\s+)?tribal\s+(?:governments|nations|entities)/i, reason: "Limited to tribal governments" },
  { re: /(?:eligible applicants are limited to|limited to)\s+(?:accredited\s+)?institutions of higher education/i, reason: "Limited to colleges and universities" },
  { re: /(?:eligible applicants are limited to|limited to)\s+states?\b/i, reason: "Limited to state governments" },
  { re: /(?:eligible applicants are limited to|limited to)\s+(?:private\s+)?nonprofit/i, reason: "Limited to nonprofit organizations" },
  { re: /individuals\s+only/i, reason: "Limited to individuals" },
  { re: /school districts?\s+only/i, reason: "Limited to school districts" },
];

export function scoreGrant(grant: Grant, profile: CityProfile | null): FitResult {
  if (!profile) return NEUTRAL;

  const reasons: string[] = [];
  const blockers: string[] = [];
  let score = 50;

  const haystack = `${grant.title} ${grant.description} ${grant.eligibility ?? ""}`.toLowerCase();
  const eligibilityText = `${grant.eligibility ?? ""} ${grant.description}`;

  // --- hard-ish eligibility signals ---
  if (grant.eligibilityCodes && grant.eligibilityCodes.length > 0 && !grant.eligibilityCodes.includes("02")) {
    blockers.push("Grants.gov does not list city governments as an eligible applicant type — check whether you can apply through your county or a special district");
    score -= 30;
  }

  for (const { re, reason } of EXCLUSIVE_PHRASES) {
    if (re.test(eligibilityText)) {
      blockers.push(reason);
      score -= 35;
      break;
    }
  }

  // --- population thresholds ---
  if (profile.population) {
    const cap = findPopulationCap(eligibilityText);
    const floor = findPopulationFloor(eligibilityText);
    if (cap !== null) {
      if (profile.population <= cap) {
        score += 12;
        reasons.push(`Your population of ${profile.population.toLocaleString()} is under the ${cap.toLocaleString()} cap this program sets`);
      } else {
        blockers.push(`This program appears capped at communities under ${cap.toLocaleString()} people`);
        score -= 30;
      }
    }
    if (floor !== null && profile.population < floor) {
      blockers.push(`This program appears to require a population over ${floor.toLocaleString()}`);
      score -= 25;
    }
  }

  // --- services operated vs. grant category ---
  const matchedService = SERVICE_OPTIONS.find(
    (s) => profile.services.includes(s.id) && s.categories.includes(grant.category),
  );
  if (matchedService) {
    score += 16;
    reasons.push(`You operate a ${matchedService.label.toLowerCase()}, which is what this ${CATEGORY_LABELS[grant.category].toLowerCase()} program funds`);
  } else if (grant.category !== "other" && profile.services.length > 0) {
    const anyServiceInCategory = SERVICE_OPTIONS.some((s) => s.categories.includes(grant.category));
    if (anyServiceInCategory) {
      score -= 12;
      reasons.push(`Your profile does not list a ${CATEGORY_LABELS[grant.category].toLowerCase()} function`);
    }
  }

  // --- stated priorities ---
  if (profile.priorities.includes(grant.category)) {
    score += 14;
    reasons.push(`${CATEGORY_LABELS[grant.category]} is one of your stated priorities`);
  }

  // --- designations that unlock or boost funding ---
  const hitDesignations = DESIGNATION_OPTIONS.filter(
    (d) => profile.designations.includes(d.id) && d.keywords.some((k) => haystack.includes(k)),
  );
  if (hitDesignations.length > 0) {
    score += Math.min(18, hitDesignations.length * 9);
    reasons.push(`The program text references ${hitDesignations.map((d) => d.label.toLowerCase()).join(" and ")}, which describes your city`);
  }

  // --- verified HUD low/mod and Opportunity Zone data ---
  const hud = profile.hudFindings;
  if (hud) {
    const mentionsLowMod = /low[- ]?(?:and )?moderate|low[- ]income|lmi|disadvantaged|distressed|underserved/i.test(
      haystack,
    );
    const mentionsOz = /opportunity zone/i.test(haystack);
    if (mentionsLowMod && hud.meetsCdbgThreshold) {
      score += 12;
      reasons.push(
        `HUD data shows ${hud.lowModPct.toFixed(1)}% of your residents are low- or moderate-income, above the 51% threshold this program references`,
      );
    } else if (mentionsLowMod) {
      reasons.push(
        `This program weights low- and moderate-income need; HUD puts your city at ${hud.lowModPct.toFixed(1)}%`,
      );
    }
    if (mentionsOz && hud.opportunityZoneTracts.length > 0) {
      score += 10;
      reasons.push(
        `Your city contains ${hud.opportunityZoneTracts.length} designated Opportunity Zone tract${hud.opportunityZoneTracts.length === 1 ? "" : "s"}, which this program references`,
      );
    }
  }



  // --- match / cost share affordability ---
  const capacity = profile.matchCapacity ? MATCH_CAPACITY_AMOUNT[profile.matchCapacity] : null;
  if (grant.costSharing === false || /no (?:cost share|match) (?:is )?required|match is waived/i.test(eligibilityText)) {
    score += 10;
    reasons.push("No local match is required");
  } else if (grant.costSharing === true || /match|cost shar/i.test(grant.matchNote ?? "")) {
    if (capacity === 0) {
      blockers.push("This program requires a local match and your profile says no cash match is available");
      score -= 22;
    } else if (capacity !== null && grant.awardCeiling && grant.awardCeiling * 0.2 > capacity) {
      score -= 10;
      reasons.push(`A typical 20% match on an award this size (about $${Math.round((grant.awardCeiling * 0.2) / 1000)}K) may exceed your stated match capacity`);
    } else {
      reasons.push("Requires a local match, which your profile says you can cover");
    }
  }

  // --- reimbursement structure ---
  if (profile.canFrontCosts === "no" && /reimburse/i.test(eligibilityText)) {
    score -= 8;
    reasons.push("This program reimburses after you spend, and your profile says you need funds up front");
  }

  // --- deadline feasibility vs. staffing ---
  const days = daysUntil(grant.closeDate);
  if (days !== null && days >= 0) {
    if (days <= 21 && profile.staffCapacity === "none") {
      score -= 12;
      reasons.push(`Only ${days} day${days === 1 ? "" : "s"} left and no one is assigned to grants — this would be a scramble`);
    } else if (days <= 45) {
      score += 4;
    }
  }
  if (grant.status === "forecasted") {
    reasons.push("Forecasted — not open yet, so there is time to prepare");
  }

  // --- watchlist keywords ---
  const keywordHits = profile.keywords.filter((k) => k.trim() && haystack.includes(k.trim().toLowerCase()));
  if (keywordHits.length > 0) {
    score += Math.min(20, keywordHits.length * 10);
    reasons.push(`Mentions your watchlist term${keywordHits.length > 1 ? "s" : ""}: ${keywordHits.join(", ")}`);
  }

  // --- Texas programs are written for Texas cities ---
  if (grant.source === "texas") {
    score += 6;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let level: FitLevel;
  if (blockers.length > 0 && score < 45) level = "unlikely";
  else if (score >= 72) level = "strong";
  else if (score >= 50) level = "possible";
  else level = "weak";

  return { score, level, reasons: reasons.slice(0, 4), blockers: blockers.slice(0, 3) };
}
