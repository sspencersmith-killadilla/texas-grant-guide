import type { HudPlaceFinding, HudTractFinding } from "../hud";

const ARC = "https://services.arcgis.com/VTyQ9soqVukalItT/arcgis/rest/services";
const LMISD_PLACE = `${ARC}/LMISD_layers/FeatureServer/1/query`;
const LMI_TRACT = `${ARC}/Low_to_Moderate_Income_Population_by_Tract/FeatureServer/4/query`;
const OZ = `${ARC}/Opportunity_Zones/FeatureServer/13/query`;
const CENSUS_GEOCODER = "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress";

const TTL = 24 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; value: unknown }>();

function cached<T>(key: string): T | null {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;
  return null;
}

function store<T>(key: string, value: T): T {
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function arcQuery(url: string, params: Record<string, string>): Promise<Record<string, unknown>[]> {
  const search = new URLSearchParams({ f: "json", returnGeometry: "false", ...params });
  const res = await fetch(`${url}?${search.toString()}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HUD data service returned ${res.status}`);
  const json = (await res.json()) as {
    error?: { message?: string };
    features?: { attributes: Record<string, unknown> }[];
  };
  if (json.error) throw new Error(json.error.message || "HUD data service rejected the request");
  return (json.features ?? []).map((f) => f.attributes);
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[%,\s]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function sqlSafe(value: string) {
  return value.replace(/'/g, "''");
}

/** Strip "City of", "Town of", "village" etc. so the name matches HUD's place names. */
function placeSearchName(city: string) {
  return city
    .replace(/^\s*(city|town|village|municipality)\s+of\s+/i, "")
    .replace(/\s+(city|town|village|cdp)\s*$/i, "")
    .trim();
}

export async function lookupPlace(city: string, state = "TX"): Promise<HudPlaceFinding> {
  const name = placeSearchName(city);
  if (!name) throw new Error("Enter a city name first.");
  const key = `place:${state}:${name.toLowerCase()}`;
  const hit = cached<HudPlaceFinding>(key);
  if (hit) return hit;

  const rows = await arcQuery(LMISD_PLACE, {
    where: `STUSAB='${sqlSafe(state)}' AND UPPER(NAME) LIKE '${sqlSafe(name.toUpperCase())}%'`,
    outFields: "GEOID,NAME,Geoname,LOWMOD,LOWMODUNIV,LOWMOD_PCT",
    resultRecordCount: "10",
  });

  if (rows.length === 0) {
    throw new Error(
      `HUD has no low- and moderate-income record for a place named "${name}" in ${state}. Check the spelling, or enter the figure manually.`,
    );
  }

  // Prefer an exact "<name> city" match over a longer name that merely starts the same.
  const exact =
    rows.find((r) => String(r.NAME ?? "").toLowerCase() === `${name.toLowerCase()} city`) ??
    rows.find((r) => String(r.NAME ?? "").toLowerCase().startsWith(`${name.toLowerCase()} `)) ??
    rows[0];

  const geoid = String(exact.GEOID ?? "");
  const opportunityZoneTracts = await opportunityZonesForPlace(geoid, state);

  return store(key, {
    kind: "place",
    placeName: String(exact.Geoname ?? exact.NAME ?? name),
    geoid,
    lowModPct: num(exact.LOWMOD_PCT) ?? 0,
    lowModCount: num(exact.LOWMOD) ?? 0,
    universe: num(exact.LOWMODUNIV) ?? 0,
    meetsCdbgThreshold: (num(exact.LOWMOD_PCT) ?? 0) >= 51,
    opportunityZoneTracts,
    checkedAt: new Date().toISOString(),
  } satisfies HudPlaceFinding);
}

/** Opportunity Zone tracts intersecting the place's bounding box. */
async function opportunityZonesForPlace(geoid: string, state: string): Promise<string[]> {
  if (!geoid) return [];
  try {
    const extentRes = await fetch(
      `${LMISD_PLACE}?${new URLSearchParams({
        f: "json",
        where: `GEOID='${sqlSafe(geoid)}'`,
        returnExtentOnly: "true",
        outSR: "4326",
      }).toString()}`,
    );
    const extentJson = (await extentRes.json()) as {
      extent?: { xmin: number; ymin: number; xmax: number; ymax: number };
    };
    const e = extentJson.extent;
    if (!e || !Number.isFinite(e.xmin)) return [];

    const rows = await arcQuery(OZ, {
      geometry: JSON.stringify({
        xmin: e.xmin,
        ymin: e.ymin,
        xmax: e.xmax,
        ymax: e.ymax,
        spatialReference: { wkid: 4326 },
      }),
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      where: `STUSAB='${sqlSafe(state)}'`,
      outFields: "GEOID10",
      resultRecordCount: "60",
    });
    return [...new Set(rows.map((r) => String(r.GEOID10 ?? "")).filter(Boolean))].sort();
  } catch {
    return [];
  }
}

interface GeocodeResult {
  matchedAddress: string;
  lon: number;
  lat: number;
  tractGeoid: string;
}

async function geocode(address: string): Promise<GeocodeResult> {
  const url = `${CENSUS_GEOCODER}?${new URLSearchParams({
    address,
    benchmark: "Public_AR_Current",
    vintage: "Census2020_Current",
    layers: "Census Tracts",
    format: "json",
  }).toString()}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`The Census address lookup returned ${res.status}`);
  const json = (await res.json()) as {
    result?: {
      addressMatches?: {
        matchedAddress?: string;
        coordinates?: { x: number; y: number };
        geographies?: Record<string, { GEOID?: string }[]>;
      }[];
    };
  };
  const match = json.result?.addressMatches?.[0];
  if (!match?.coordinates) throw new Error("That address could not be located. Try a full street address with city and state.");
  return {
    matchedAddress: match.matchedAddress ?? address,
    lon: match.coordinates.x,
    lat: match.coordinates.y,
    tractGeoid: match.geographies?.["Census Tracts"]?.[0]?.GEOID ?? "",
  };
}

/** Look up a project location: by street address, or directly by an 11-digit tract GEOID. */
export async function lookupLocation(input: string): Promise<HudTractFinding> {
  const raw = input.trim();
  if (!raw) throw new Error("Enter a project address or an 11-digit census tract number.");
  const key = `loc:${raw.toLowerCase()}`;
  const hit = cached<HudTractFinding>(key);
  if (hit) return hit;

  const isTract = /^\d{11}$/.test(raw);

  let matchedAddress = `Census tract ${raw}`;
  let tractGeoid = raw;
  let point: { x: number; y: number } | null = null;

  if (!isTract) {
    const geo = await geocode(raw);
    matchedAddress = geo.matchedAddress;
    tractGeoid = geo.tractGeoid;
    point = { x: geo.lon, y: geo.lat };
  }

  const spatial = point
    ? {
        geometry: JSON.stringify({ x: point.x, y: point.y, spatialReference: { wkid: 4326 } }),
        geometryType: "esriGeometryPoint",
        inSR: "4326",
        spatialRel: "esriSpatialRelIntersects",
        where: "1=1",
      }
    : null;

  const byGeoid = (field: string) => ({ where: `${field}='${sqlSafe(tractGeoid)}'` });

  const [lmiRows, ozRows] = await Promise.all([
    arcQuery(LMI_TRACT, {
      ...(spatial ?? byGeoid("GEOID")),
      outFields: "GEOID,LOWMOD,LOWMODUNIV,LOWMODPCT",
      resultRecordCount: "1",
    }).catch(() => []),
    arcQuery(OZ, {
      ...(spatial ?? byGeoid("GEOID10")),
      outFields: "GEOID10,Rural",
      resultRecordCount: "1",
    }).catch(() => []),
  ]);

  const lmi = lmiRows[0];
  const pct = lmi ? num(lmi.LOWMODPCT) : null;
  const oz = ozRows[0];

  if (!lmi && !oz && !tractGeoid) {
    throw new Error("HUD returned no data for that location. Enter the figures manually.");
  }

  return store(key, {
    kind: "tract",
    matchedAddress,
    tractGeoid: tractGeoid || String(lmi?.GEOID ?? oz?.GEOID10 ?? ""),
    lowModPct: pct,
    lowModCount: lmi ? num(lmi.LOWMOD) : null,
    universe: lmi ? num(lmi.LOWMODUNIV) : null,
    isLowModArea: (pct ?? 0) >= 51,
    inOpportunityZone: Boolean(oz),
    ozRural: String(oz?.Rural ?? "").toLowerCase() === "yes",
    checkedAt: new Date().toISOString(),
  } satisfies HudTractFinding);
}
