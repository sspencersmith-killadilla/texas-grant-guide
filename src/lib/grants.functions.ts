import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Grant, PlainSummary } from "./grants/types";

const federalCache: { at: number; data: Grant[] } = { at: 0, data: [] };
const CACHE_MS = 30 * 60 * 1000;

export const listGrants = createServerFn({ method: "GET" }).handler(async (): Promise<{
  grants: Grant[];
  federalError: string | null;
}> => {
  const { TEXAS_GRANTS } = await import("./grants/texas");
  let federal: Grant[] = [];
  let federalError: string | null = null;

  if (Date.now() - federalCache.at < CACHE_MS && federalCache.data.length > 0) {
    federal = federalCache.data;
  } else {
    try {
      const { fetchFederalGrants } = await import("./grants/grants-gov.server");
      federal = await fetchFederalGrants();
      federalCache.at = Date.now();
      federalCache.data = federal;
    } catch (error) {
      federalError = error instanceof Error ? error.message : "Could not reach Grants.gov";
      federal = federalCache.data;
    }
  }

  return { grants: [...TEXAS_GRANTS, ...federal], federalError };
});

export const getGrant = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }): Promise<Grant | null> => {
    if (data.id.startsWith("fed-")) {
      const { fetchFederalGrantDetail } = await import("./grants/grants-gov.server");
      return fetchFederalGrantDetail(data.id);
    }
    const { TEXAS_GRANTS } = await import("./grants/texas");
    return TEXAS_GRANTS.find((g) => g.id === data.id) ?? null;
  });

const summarySchema = z.object({
  id: z.string(),
  title: z.string(),
  agency: z.string(),
  description: z.string(),
  eligibility: z.string().optional(),
  closeDate: z.string().optional(),
  openDate: z.string().optional(),
  deadlineNote: z.string().optional(),
  matchNote: z.string().optional(),
  costSharing: z.boolean().optional(),
});

export const summarizeGrant = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => summarySchema.parse(data))
  .handler(async ({ data }): Promise<PlainSummary> => {
    const { callAi, parseJsonLoose } = await import("./grants/ai.server");

    const raw = await callAi(
      [
        {
          role: "system",
          content:
            "You explain government grants to Texas city staff who are not professional grant writers. Write in plain English at roughly an 8th grade reading level. Never invent dates, dollar amounts or requirements that are not supported by the source text; if something is unknown, say so plainly. Respond with JSON only.",
        },
        {
          role: "user",
          content: `Summarize this grant for a Texas municipality.

Title: ${data.title}
Agency: ${data.agency}
Opens: ${data.openDate ?? "unknown"}
Closes: ${data.closeDate ?? "unknown"}
Deadline note: ${data.deadlineNote ?? "none"}
Match/cost share: ${data.matchNote ?? (data.costSharing === true ? "cost sharing required" : data.costSharing === false ? "no cost sharing required" : "unknown")}
Eligibility: ${data.eligibility ?? "unknown"}

Official text:
"""
${data.description.slice(0, 9000)}
"""

Return JSON with exactly these keys:
{
  "headline": "one sentence, max 20 words, what this grant is for",
  "whatItFunds": "2-4 sentences",
  "whoCanApply": "2-3 sentences focused on whether a Texas city qualifies",
  "whatItCostsYou": "2-3 sentences on match, cost share, staff time and reimbursement",
  "whatYoullNeed": "2-4 sentences on documents, plans, registrations and approvals typically required",
  "timeline": [{"label":"short label","date":"human readable date or 'Varies'","note":"one short sentence"}],
  "goodFitIf": ["3 to 5 short bullet phrases"]
}
The timeline should have 3 to 5 steps in chronological order.`,
        },
      ],
      true,
    );

    const parsed = parseJsonLoose<PlainSummary>(raw);
    if (!parsed) {
      throw new Error("The summary could not be generated. Please try again.");
    }
    return {
      headline: parsed.headline ?? "",
      whatItFunds: parsed.whatItFunds ?? "",
      whoCanApply: parsed.whoCanApply ?? "",
      whatItCostsYou: parsed.whatItCostsYou ?? "",
      whatYoullNeed: parsed.whatYoullNeed ?? "",
      timeline: Array.isArray(parsed.timeline) ? parsed.timeline.slice(0, 6) : [],
      goodFitIf: Array.isArray(parsed.goodFitIf) ? parsed.goodFitIf.slice(0, 6) : [],
    };
  });

const draftSchema = z.object({
  grantTitle: z.string(),
  grantAgency: z.string(),
  grantDescription: z.string(),
  answers: z.array(z.object({ question: z.string(), answer: z.string() })).min(1),
});

export interface DraftSection {
  heading: string;
  body: string;
}

export const generateDraft = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => draftSchema.parse(data))
  .handler(async ({ data }): Promise<{ sections: DraftSection[] }> => {
    const { callAi, parseJsonLoose } = await import("./grants/ai.server");

    const answers = data.answers.map((a) => `Q: ${a.question}\nA: ${a.answer || "(not provided)"}`).join("\n\n");

    const raw = await callAi(
      [
        {
          role: "system",
          content:
            "You are an experienced municipal grant writer in Texas. You write clear, specific, reviewer-friendly narrative prose. You never fabricate statistics, citations, prior awards or partner commitments. Where a specific figure or document is needed but was not provided, insert a clearly marked placeholder in square brackets such as [INSERT 2020 Census population] so city staff know exactly what to fill in. Respond with JSON only.",
        },
        {
          role: "user",
          content: `Write a first-draft grant application narrative.

GRANT
Title: ${data.grantTitle}
Agency: ${data.grantAgency}
Program description: ${data.grantDescription.slice(0, 6000)}

APPLICANT ANSWERS
${answers}

Return JSON:
{"sections":[{"heading":"Executive Summary","body":"..."}, ...]}

Use exactly these nine sections in this order: Executive Summary, Statement of Need, Project Description, Goals and Measurable Outcomes, Budget Narrative, Match and Leverage, Implementation Timeline, Organizational Capacity and Management, Evaluation Plan.
Each body should be 2 to 5 paragraphs of flowing prose separated by blank lines. Do not use markdown formatting, headings or bullet characters inside the body text. Ground every claim in the applicant answers above.`,
        },
      ],
      true,
    );

    const parsed = parseJsonLoose<{ sections?: DraftSection[] }>(raw);
    if (!parsed?.sections?.length) {
      throw new Error("The draft could not be generated. Please try again.");
    }
    return {
      sections: parsed.sections
        .filter((s) => s && typeof s.heading === "string" && typeof s.body === "string")
        .map((s) => ({ heading: s.heading, body: s.body })),
    };
  });
