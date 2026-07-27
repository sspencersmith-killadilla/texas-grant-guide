import type { Grant } from "./types";

const CACHE_MS = 45 * 60 * 1000;

const federalCache: { at: number; data: Grant[] } = { at: 0, data: [] };

export interface GrantListing {
  grants: Grant[];
  federalError: string | null;
  syncedAt: string | null;
}

export async function loadAllGrants(): Promise<GrantListing> {
  const { TEXAS_GRANTS } = await import("./texas");
  const { FEDERAL_CURATED_GRANTS } = await import("./federal-curated");

  let federal: Grant[] = [];
  let federalError: string | null = null;

  if (Date.now() - federalCache.at < CACHE_MS && federalCache.data.length > 0) {
    federal = federalCache.data;
  } else {
    try {
      const { fetchFederalGrants } = await import("./grants-gov.server");
      federal = await fetchFederalGrants();
      federalCache.at = Date.now();
      federalCache.data = federal;
    } catch (error) {
      federalError = error instanceof Error ? error.message : "Could not reach Grants.gov";
      federal = federalCache.data;
    }
  }

  const curatedIds = new Set(FEDERAL_CURATED_GRANTS.map((g) => g.id));
  return {
    grants: [...TEXAS_GRANTS, ...FEDERAL_CURATED_GRANTS, ...federal.filter((g) => !curatedIds.has(g.id))],
    federalError,
    syncedAt: federalCache.at ? new Date(federalCache.at).toISOString() : null,
  };
}

export async function loadGrantById(id: string): Promise<Grant | null> {
  if (id.startsWith("fed-")) {
    const { FEDERAL_CURATED_GRANTS } = await import("./federal-curated");
    const curated = FEDERAL_CURATED_GRANTS.find((g) => g.id === id);
    if (curated) return curated;

    const cached = federalCache.data.find((g) => g.id === id);
    const { fetchFederalGrantDetail } = await import("./grants-gov.server");
    const detail = await fetchFederalGrantDetail(id);
    if (detail) return { ...detail, status: cached?.status, eligibilityCodes: cached?.eligibilityCodes };
    return cached ?? null;
  }

  const { TEXAS_GRANTS } = await import("./texas");
  return TEXAS_GRANTS.find((g) => g.id === id) ?? null;
}
