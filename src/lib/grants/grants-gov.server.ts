import type { Grant, GrantCategory } from "./types";

const SEARCH_URL = "https://api.grants.gov/v1/api/search2";
const FETCH_URL = "https://api.grants.gov/v1/api/fetchOpportunity";
const CITY_ELIGIBILITY = "02"; // City or township governments

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  quot: '"',
  apos: "'",
  lsquo: "\u2018",
  rsquo: "\u2019",
  ldquo: "\u201C",
  rdquo: "\u201D",
  ndash: "\u2013",
  mdash: "\u2014",
  bull: "\u2022",
  hellip: "\u2026",
  lt: "<",
  gt: ">",
};

export function decodeEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match)
    .replace(/\s+/g, " ")
    .trim();
}

function categorize(text: string): GrantCategory {
  const t = text.toLowerCase();
  const rules: [GrantCategory, string[]][] = [
    ["water", ["water", "wastewater", "sewer", "drought", "watershed", "stormwater", "drinking"]],
    ["transportation", ["transportation", "transit", "highway", "roadway", "bridge", "bicycle", "pedestrian", "airport", "rail"]],
    ["public-safety", ["police", "law enforcement", "crime", "fire", "firefighter", "safety", "justice", "violence"]],
    ["emergency", ["emergency", "disaster", "hazard mitigation", "resilience", "flood mitigation", "preparedness"]],
    ["parks", ["park", "recreation", "trail", "outdoor", "open space"]],
    ["broadband", ["broadband", "internet", "digital equity", "telecommunications"]],
    ["housing", ["housing", "homeless", "shelter", "rental"]],
    ["energy", ["energy", "solar", "emission", "air quality", "electric vehicle", "efficiency"]],
    ["community", ["community development", "downtown", "economic development", "historic", "preservation", "planning", "arts"]],
  ];
  for (const [cat, words] of rules) {
    if (words.some((w) => t.includes(w))) return cat;
  }
  return "other";
}

function parseMmDdYyyy(value?: string): string | undefined {
  if (!value) return undefined;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!m) return undefined;
  return `${m[3]}-${m[1]}-${m[2]}T00:00:00.000Z`;
}

function parseLooseDate(value?: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

interface SearchHit {
  id: string;
  number: string;
  title: string;
  agency: string;
  openDate?: string;
  closeDate?: string;
  oppStatus?: string;
}

export async function fetchFederalGrants(): Promise<Grant[]> {
  const res = await fetch(SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rows: 200,
      oppStatuses: "posted|forecasted",
      eligibilities: CITY_ELIGIBILITY,
      sortBy: "closeDate|asc",
    }),
  });

  if (!res.ok) throw new Error(`Grants.gov search failed (${res.status})`);
  const json = (await res.json()) as { errorcode: number; data?: { oppHits?: SearchHit[] } };
  const hits = json.data?.oppHits ?? [];
  const now = new Date().toISOString();

  return hits.map((hit) => ({
    id: `fed-${hit.id}`,
    source: "federal" as const,
    title: hit.title,
    agency: hit.agency,
    number: hit.number,
    category: categorize(`${hit.title} ${hit.agency}`),
    openDate: parseMmDdYyyy(hit.openDate),
    closeDate: parseMmDdYyyy(hit.closeDate),
    url: `https://www.grants.gov/search-results-detail/${hit.id}`,
    description: "",
    lastChecked: now,
  }));
}

export async function fetchFederalGrantDetail(rawId: string): Promise<Grant | null> {
  const numericId = Number(rawId.replace(/^fed-/, ""));
  if (!Number.isFinite(numericId)) return null;

  const res = await fetch(FETCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ opportunityId: numericId }),
  });
  if (!res.ok) return null;

  const json = (await res.json()) as {
    data?: {
      opportunityTitle?: string;
      opportunityNumber?: string;
      synopsis?: Record<string, unknown>;
    };
  };
  const data = json.data;
  const syn = data?.synopsis as
    | {
        agencyName?: string;
        agencyDetails?: { agencyName?: string };
        topAgencyDetails?: { agencyName?: string };
        synopsisDesc?: string;
        responseDate?: string;
        responseDateDesc?: string;
        postingDate?: string;
        costSharing?: boolean;
        estimatedFunding?: string;
        awardCeiling?: string;
        awardFloor?: string;
        applicantEligibilityDesc?: string;
        agencyContactDesc?: string;
        agencyContactEmail?: string;
      }
    | undefined;
  if (!data || !syn) return null;

  const stripTags = (html?: string) => decodeEntities((html ?? "").replace(/<[^>]+>/g, " "));

  const num = (v?: string) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  const title = decodeEntities(data.opportunityTitle ?? "Federal grant opportunity");

  return {
    id: `fed-${numericId}`,
    source: "federal",
    title,
    agency:
      syn.agencyDetails?.agencyName ??
      syn.topAgencyDetails?.agencyName ??
      "Federal agency",

    number: data.opportunityNumber,
    category: categorize(`${title} ${stripTags(syn.synopsisDesc).slice(0, 400)}`),
    openDate: parseLooseDate(syn.postingDate),
    closeDate: parseLooseDate(syn.responseDate),
    deadlineNote: stripTags(syn.responseDateDesc) || undefined,
    estimatedFunding: num(syn.estimatedFunding),
    awardCeiling: num(syn.awardCeiling),
    awardFloor: num(syn.awardFloor),
    costSharing: syn.costSharing,
    url: `https://www.grants.gov/search-results-detail/${numericId}`,
    description: stripTags(syn.synopsisDesc),
    eligibility: stripTags(syn.applicantEligibilityDesc) || undefined,
    contact: [stripTags(syn.agencyContactDesc), syn.agencyContactEmail].filter(Boolean).join(" · ") || undefined,
    lastChecked: new Date().toISOString(),
  };
}
