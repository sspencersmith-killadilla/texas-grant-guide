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
    [
      "culture",
      [
        "library",
        "libraries",
        "librarian",
        "museum",
        "archive",
        "humanities",
        "arts",
        "cultural",
        "literacy",
      ],
    ],
    ["tourism", ["tourism", "tourist", "travel promotion", "visitor", "heritage tourism"]],
    ["water", ["water", "wastewater", "sewer", "drought", "watershed", "stormwater", "drinking"]],
    ["transportation", ["transportation", "transit", "highway", "roadway", "bridge", "bicycle", "pedestrian", "airport", "rail"]],
    ["public-safety", ["police", "law enforcement", "crime", "fire", "firefighter", "safety", "justice", "violence"]],
    ["emergency", ["emergency", "disaster", "hazard mitigation", "resilience", "flood mitigation", "preparedness"]],
    ["parks", ["park", "recreation", "trail", "outdoor", "open space"]],
    ["broadband", ["broadband", "internet", "digital equity", "telecommunications"]],
    ["housing", ["housing", "homeless", "shelter", "rental"]],
    ["energy", ["energy", "solar", "emission", "air quality", "electric vehicle", "efficiency"]],
    ["community", ["community development", "downtown", "economic development", "historic", "preservation", "planning"]],
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
  agencyCode?: string;
  openDate?: string;
  closeDate?: string;
  oppStatus?: string;
}

/**
 * Eligibility codes a Texas city can realistically apply under.
 * 02 = city/township, 01 = county, 04 = special district, 25 = others, 99 = unrestricted.
 */
const ELIGIBILITY_CODES = ["02", "01", "04", "25", "99"];
const PAGE_SIZE = 100;
const MAX_PAGES_PER_CODE = 8;

async function searchPage(code: string, start: number): Promise<{ hits: SearchHit[]; total: number }> {
  const res = await fetch(SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rows: PAGE_SIZE,
      startRecordNum: start,
      oppStatuses: "posted|forecasted",
      eligibilities: code,
      sortBy: "closeDate|asc",
    }),
  });
  if (!res.ok) throw new Error(`Grants.gov search failed (${res.status})`);
  const json = (await res.json()) as {
    data?: { oppHits?: SearchHit[]; hitCount?: number };
  };
  return { hits: json.data?.oppHits ?? [], total: json.data?.hitCount ?? 0 };
}

/** Pull every municipal-eligible opportunity across all relevant eligibility codes. */
export async function fetchFederalGrants(): Promise<Grant[]> {
  const now = new Date().toISOString();
  const byId = new Map<string, Grant>();
  let anySuccess = false;
  let lastError: unknown = null;

  for (const code of ELIGIBILITY_CODES) {
    try {
      let start = 0;
      for (let page = 0; page < MAX_PAGES_PER_CODE; page += 1) {
        const { hits, total } = await searchPage(code, start);
        anySuccess = true;
        if (hits.length === 0) break;

        for (const hit of hits) {
          const id = `fed-${hit.id}`;
          const existing = byId.get(id);
          if (existing) {
            if (!existing.eligibilityCodes?.includes(code)) existing.eligibilityCodes?.push(code);
            continue;
          }
          const title = decodeEntities(hit.title ?? "");
          byId.set(id, {
            id,
            source: "federal",
            title,
            agency: decodeEntities(hit.agency ?? "Federal agency"),
            number: hit.number,
            category: categorize(`${title} ${hit.agency ?? ""}`),
            status: /forecast/i.test(hit.oppStatus ?? "") ? "forecasted" : "posted",
            eligibilityCodes: [code],
            openDate: parseMmDdYyyy(hit.openDate),
            closeDate: parseMmDdYyyy(hit.closeDate),
            url: `https://www.grants.gov/search-results-detail/${hit.id}`,
            description: "",
            lastChecked: now,
          });
        }

        start += hits.length;
        if (start >= total) break;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (!anySuccess) {
    throw lastError instanceof Error ? lastError : new Error("Grants.gov could not be reached");
  }

  const grants = [...byId.values()];
  await hydrateDescriptions(grants);
  return grants;
}

/**
 * Grants.gov search only returns titles, so keyword search and fit scoring would be blind
 * to the actual program text. Pull full synopses for the most relevant opportunities,
 * newest deadlines first, inside a time budget so the request never hangs.
 */
async function hydrateDescriptions(grants: Grant[], budgetMs = 22_000, concurrency = 10) {
  const deadline = Date.now() + budgetMs;
  const queue = [...grants]
    .filter((g) => !g.description)
    .sort((a, b) => {
      const da = a.closeDate ? Date.parse(a.closeDate) : Number.MAX_SAFE_INTEGER;
      const db = b.closeDate ? Date.parse(b.closeDate) : Number.MAX_SAFE_INTEGER;
      return da - db;
    });

  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < queue.length && Date.now() < deadline) {
      const grant = queue[cursor];
      cursor += 1;
      try {
        const detail = await fetchFederalGrantDetail(grant.id);
        if (detail) {
          Object.assign(grant, {
            description: detail.description,
            eligibility: detail.eligibility,
            deadlineNote: detail.deadlineNote,
            estimatedFunding: detail.estimatedFunding,
            awardCeiling: detail.awardCeiling,
            awardFloor: detail.awardFloor,
            costSharing: detail.costSharing,
            contact: detail.contact,
            agency: detail.agency || grant.agency,
            category: detail.category,
            openDate: detail.openDate ?? grant.openDate,
            closeDate: detail.closeDate ?? grant.closeDate,
          });
        }
      } catch {
        // leave the title-only record in place
      }
    }
  });

  await Promise.all(workers);
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
