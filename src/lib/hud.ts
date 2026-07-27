/** Shared, client-safe types for HUD low- and moderate-income and Opportunity Zone data. */

export interface HudPlaceFinding {
  kind: "place";
  /** HUD's own name for the place, e.g. "Bastrop city, Texas". */
  placeName: string;
  geoid: string;
  /** Percent of residents who are low- or moderate-income (HUD LMISD). */
  lowModPct: number;
  lowModCount: number;
  universe: number;
  /** True at or above the 51% CDBG low/mod area benefit threshold. */
  meetsCdbgThreshold: boolean;
  /** Opportunity Zone census tracts inside or overlapping the city. */
  opportunityZoneTracts: string[];
  checkedAt: string;
}

export interface HudTractFinding {
  kind: "tract";
  matchedAddress: string;
  tractGeoid: string;
  lowModPct: number | null;
  lowModCount: number | null;
  universe: number | null;
  /** True at or above 51% low/mod. */
  isLowModArea: boolean;
  inOpportunityZone: boolean;
  ozRural: boolean;
  checkedAt: string;
}

export type HudFinding = HudPlaceFinding | HudTractFinding;

export const HUD_SOURCE_NOTE =
  "HUD Low- and Moderate-Income Summary Data (LMISD, American Community Survey based) and the Treasury/HUD Qualified Opportunity Zone tract list.";

export function pctText(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(1)}%` : "unknown";
}

/** A sentence a city can paste straight into a statement of need. */
export function citationSentence(finding: HudFinding): string {
  if (finding.kind === "place") {
    const oz = finding.opportunityZoneTracts.length;
    return `According to HUD's Low- and Moderate-Income Summary Data, ${pctText(finding.lowModPct)} of the ${finding.universe.toLocaleString()} residents of ${finding.placeName} are low- or moderate-income${
      finding.meetsCdbgThreshold ? ", which exceeds the 51 percent CDBG area-benefit threshold" : ""
    }.${oz > 0 ? ` The city contains ${oz} designated Qualified Opportunity Zone census tract${oz === 1 ? "" : "s"} (${finding.opportunityZoneTracts.join(", ")}).` : ""}`;
  }
  const lmi =
    finding.lowModPct !== null
      ? `Census tract ${finding.tractGeoid}, where the project is located, has a HUD low- and moderate-income population of ${pctText(finding.lowModPct)}${
          finding.isLowModArea ? ", above the 51 percent area-benefit threshold" : ""
        }.`
      : `The project is located in census tract ${finding.tractGeoid}; HUD publishes no low/mod figure for this tract.`;
  return `${lmi}${finding.inOpportunityZone ? ` This tract is a designated Qualified Opportunity Zone${finding.ozRural ? " and is classified as rural" : ""}.` : ""}`;
}

/** Short label for badges. */
export function findingHeadline(finding: HudFinding): string {
  if (finding.kind === "place") {
    return `${pctText(finding.lowModPct)} low/mod · ${finding.opportunityZoneTracts.length} Opportunity Zone tract${
      finding.opportunityZoneTracts.length === 1 ? "" : "s"
    }`;
  }
  return `${pctText(finding.lowModPct)} low/mod · ${finding.inOpportunityZone ? "in an Opportunity Zone" : "not in an Opportunity Zone"}`;
}
