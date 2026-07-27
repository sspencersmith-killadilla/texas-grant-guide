import { callAi, parseJsonLoose } from "./ai.server";
import { SECTION_HEADINGS, type ChecklistItem, type DraftSection, type ExtraQuestion, type Scorecard } from "./schemas";
import type { PlainSummary } from "./types";

const NO_FABRICATION =
  "You never fabricate statistics, citations, prior awards, partner commitments or dollar figures. Where a specific figure or document is needed but was not provided, insert a clearly marked placeholder in square brackets such as [INSERT 2020 Census population] so city staff know exactly what to fill in. Respond with JSON only.";

interface GrantContext {
  grantTitle: string;
  grantAgency: string;
  grantDescription: string;
  grantEligibility?: string;
}

function contextBlock(ctx: GrantContext, limit = 6000) {
  return `Title: ${ctx.grantTitle}
Agency: ${ctx.grantAgency}
Program description: ${ctx.grantDescription.slice(0, limit)}
${ctx.grantEligibility ? `Published eligibility: ${ctx.grantEligibility.slice(0, 1500)}` : ""}`;
}

export async function buildPlainSummary(data: {
  title: string;
  agency: string;
  description: string;
  eligibility?: string;
  closeDate?: string;
  openDate?: string;
  deadlineNote?: string;
  matchNote?: string;
  costSharing?: boolean;
}): Promise<PlainSummary> {
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
  if (!parsed) throw new Error("The summary could not be generated. Please try again.");
  return {
    headline: parsed.headline ?? "",
    whatItFunds: parsed.whatItFunds ?? "",
    whoCanApply: parsed.whoCanApply ?? "",
    whatItCostsYou: parsed.whatItCostsYou ?? "",
    whatYoullNeed: parsed.whatYoullNeed ?? "",
    timeline: Array.isArray(parsed.timeline) ? parsed.timeline.slice(0, 6) : [],
    goodFitIf: Array.isArray(parsed.goodFitIf) ? parsed.goodFitIf.slice(0, 6) : [],
  };
}

/** Questions tied to this specific program's published review criteria. */
export async function buildExtraQuestions(
  ctx: GrantContext & { cityProfile?: string },
): Promise<ExtraQuestion[]> {
  const raw = await callAi(
    [
      {
        role: "system",
        content:
          "You are a federal and state grant reviewer who knows exactly which specifics separate a funded municipal application from a rejected one. You ask short, concrete questions a city clerk or public works director could answer without research. Respond with JSON only.",
      },
      {
        role: "user",
        content: `Read this notice of funding opportunity and write the extra questions this specific program requires that a generic application questionnaire would miss.

${contextBlock(ctx)}

${ctx.cityProfile ? `The applicant city:\n${ctx.cityProfile}` : ""}

The applicant has already been asked generic questions about: the applying city and its size, the problem being solved, the project scope, who benefits and how many, total cost and amount requested, local match and in-kind contributions, timeline and project manager, and how success will be measured. Do NOT repeat any of those.

Ask 3 to 6 additional questions drawn from this program's own stated review criteria, statutory requirements, required certifications or scoring priorities. Examples of the kind of specificity wanted: a benefit-cost ratio for hazard mitigation, the low- and moderate-income percentage for CDBG, a service population count for library funds, an adopted plan the project must be consistent with.

Return JSON:
{"questions":[{"id":"short-kebab-id","label":"the question in plain English","helper":"one sentence saying why this program cares and where to find the answer","placeholder":"a realistic short example answer for a Texas city"}]}`,
      },
    ],
    true,
  );

  const parsed = parseJsonLoose<{ questions?: ExtraQuestion[] }>(raw);
  const questions = Array.isArray(parsed?.questions) ? parsed!.questions : [];
  return questions
    .filter((q) => q && typeof q.label === "string" && q.label.trim())
    .slice(0, 6)
    .map((q, i) => ({
      id: (q.id && String(q.id).replace(/[^a-z0-9-]/gi, "-")) || `extra-${i}`,
      label: q.label,
      helper: q.helper ?? "",
      placeholder: q.placeholder ?? "",
    }));
}

/** Two passes: write the narrative, then revise it as a program officer would. */
export async function buildDraft(data: {
  grantTitle: string;
  grantAgency: string;
  grantDescription: string;
  grantEligibility?: string;
  cityProfile?: string;
  answers: { question: string; answer: string }[];
}): Promise<DraftSection[]> {
  const answers = data.answers
    .map((a) => `Q: ${a.question}\nA: ${a.answer?.trim() || "(not provided)"}`)
    .join("\n\n");

  const firstPass = await callAi(
    [
      {
        role: "system",
        content: `You are an experienced municipal grant writer in Texas. You write clear, specific, reviewer-friendly narrative prose. ${NO_FABRICATION}`,
      },
      {
        role: "user",
        content: `Write a first-draft grant application narrative.

GRANT
${contextBlock(data)}

${data.cityProfile ? `APPLICANT CITY PROFILE\n${data.cityProfile}\n` : ""}
APPLICANT ANSWERS
${answers}

Return JSON:
{"sections":[{"heading":"Executive Summary","body":"..."}, ...]}

Use exactly these nine sections in this order: ${SECTION_HEADINGS.join(", ")}.
Each body should be 2 to 5 paragraphs of flowing prose separated by blank lines. Do not use markdown formatting, headings or bullet characters inside the body text. Ground every claim in the applicant answers above.`,
      },
    ],
    true,
  );

  const drafted = parseJsonLoose<{ sections?: DraftSection[] }>(firstPass);
  const sections = (drafted?.sections ?? []).filter(
    (s) => s && typeof s.heading === "string" && typeof s.body === "string",
  );
  if (sections.length === 0) throw new Error("The draft could not be generated. Please try again.");

  // Second pass: revise against the funder's own evaluation criteria.
  try {
    const secondPass = await callAi(
      [
        {
          role: "system",
          content: `You are a program officer for the funding agency who has scored hundreds of municipal applications. You rewrite drafts so every claim is specific, measurable and traceable to what the applicant actually said. You tighten vague language, remove filler, and surface the evidence a scorer looks for. You never add facts the applicant did not provide — if specificity is missing, you convert the vague sentence into a clearly marked bracketed placeholder instead. ${NO_FABRICATION}`,
        },
        {
          role: "user",
          content: `Revise this draft against the funding notice below.

FUNDING NOTICE
${contextBlock(data, 5000)}

APPLICANT ANSWERS (the only permitted source of facts)
${answers}

CURRENT DRAFT
${JSON.stringify(sections).slice(0, 22000)}

For each section: align it with the program's stated review criteria and priorities, replace generic assertions with specific ones drawn from the answers, make outcomes measurable, and make sure the section actually answers what this funder asks for. Keep the same nine headings and the same order. Keep prose paragraphs separated by blank lines, no markdown.

Return JSON: {"sections":[{"heading":"...","body":"..."}]}`,
        },
      ],
      true,
    );

    const revised = parseJsonLoose<{ sections?: DraftSection[] }>(secondPass);
    const revisedSections = (revised?.sections ?? []).filter(
      (s) => s && typeof s.heading === "string" && typeof s.body === "string" && s.body.trim().length > 40,
    );
    if (revisedSections.length >= sections.length - 1 && revisedSections.length > 0) {
      return revisedSections.map((s) => ({ heading: s.heading, body: s.body }));
    }
  } catch {
    // fall back to the first-pass draft rather than failing the whole generation
  }

  return sections.map((s) => ({ heading: s.heading, body: s.body }));
}

export async function buildReview(
  data: GrantContext & { sections: DraftSection[] },
): Promise<Scorecard> {
  const raw = await callAi(
    [
      {
        role: "system",
        content:
          "You are a grant review panelist scoring a municipal application. You are candid and specific. You point at the exact missing number, document or claim rather than giving generic advice. Respond with JSON only.",
      },
      {
        role: "user",
        content: `Score this draft application against the funder's own evaluation criteria.

FUNDING NOTICE
${contextBlock(data, 5000)}

DRAFT
${JSON.stringify(data.sections).slice(0, 22000)}

Use the criteria this notice actually publishes. If the notice does not publish criteria, use: Need, Project Design, Measurable Outcomes, Budget Justification, Match and Leverage, Organizational Capacity.

Return JSON:
{
  "overall": 0-100 integer,
  "summary": "two sentences on where this draft stands",
  "criteria": [{"name":"criterion name","score":0-10 integer,"comment":"one specific sentence"}],
  "gaps": [{"issue":"the concrete thing that is missing","section":"which of the nine section headings it belongs in","fix":"exactly what the city should add"}]
}
List 3 to 8 gaps, most damaging first. Treat every unfilled [bracketed placeholder] as a gap.`,
      },
    ],
    true,
  );

  const parsed = parseJsonLoose<Scorecard>(raw);
  if (!parsed) throw new Error("The review could not be generated. Please try again.");
  return {
    overall: Math.max(0, Math.min(100, Math.round(Number(parsed.overall) || 0))),
    summary: parsed.summary ?? "",
    criteria: Array.isArray(parsed.criteria)
      ? parsed.criteria
          .filter((c) => c && typeof c.name === "string")
          .slice(0, 10)
          .map((c) => ({
            name: c.name,
            score: Math.max(0, Math.min(10, Math.round(Number(c.score) || 0))),
            comment: c.comment ?? "",
          }))
      : [],
    gaps: Array.isArray(parsed.gaps)
      ? parsed.gaps
          .filter((g) => g && typeof g.issue === "string")
          .slice(0, 10)
          .map((g) => ({ issue: g.issue, section: g.section ?? "", fix: g.fix ?? "" }))
      : [],
  };
}

export async function buildRevision(
  data: GrantContext & { heading: string; body: string; instruction: string; cityProfile?: string },
): Promise<string> {
  const raw = await callAi(
    [
      {
        role: "system",
        content: `You are an experienced municipal grant writer revising one section of an application. You return only that section, rewritten. ${NO_FABRICATION}`,
      },
      {
        role: "user",
        content: `FUNDING NOTICE
${contextBlock(data, 3500)}

${data.cityProfile ? `APPLICANT CITY\n${data.cityProfile}\n` : ""}
SECTION: ${data.heading}
CURRENT TEXT
"""
${data.body.slice(0, 9000)}
"""

INSTRUCTION FROM THE APPLICANT: ${data.instruction}

Rewrite the section following the instruction. Keep prose paragraphs separated by blank lines, no markdown or bullet characters. Do not invent facts; use bracketed placeholders where a specific figure is needed.

Return JSON: {"body":"the rewritten section"}`,
      },
    ],
    true,
  );

  const parsed = parseJsonLoose<{ body?: string }>(raw);
  if (!parsed?.body) throw new Error("That section could not be rewritten. Please try again.");
  return parsed.body;
}

const BASELINE_CHECKLIST: ChecklistItem[] = [
  { id: "uei", label: "Active SAM.gov registration and UEI number", detail: "Federal awards cannot be made without an active registration. Renewal takes weeks, so start early." },
  { id: "resolution", label: "Resolution from the governing body authorizing the application", detail: "Most funders require a council resolution naming the project and authorizing an official to sign." },
  { id: "financials", label: "Most recent audited financial statements", detail: "Usually the last completed fiscal year, sometimes the last two or three." },
  { id: "budget", label: "Completed budget forms with a line-item budget", detail: "Program budget forms are separate from the narrative budget justification." },
  { id: "match", label: "Documentation of the local match", detail: "A budget page, council minutes or a letter identifying the exact source of matching funds." },
  { id: "support", label: "Letters of support or commitment from partners", detail: "Name specific commitments rather than general encouragement." },
  { id: "signature", label: "Signed certifications and assurances", detail: "Lobbying, non-discrimination, drug-free workplace and similar standard federal forms." },
];

export async function buildChecklist(ctx: GrantContext): Promise<ChecklistItem[]> {
  try {
    const raw = await callAi(
      [
        {
          role: "system",
          content:
            "You list the attachments and registrations a municipal applicant must have ready alongside the narrative. You only list items supported by the notice text or standard for this type of award. Respond with JSON only.",
        },
        {
          role: "user",
          content: `${contextBlock(ctx, 7000)}

List every attachment, form, registration, plan, certification or approval this application requires from a Texas city.

Return JSON: {"items":[{"id":"short-kebab-id","label":"short name of the item","detail":"one sentence on what it is and where a city gets it"}]}
List 6 to 14 items, most time-consuming to obtain first.`,
        },
      ],
      true,
    );

    const parsed = parseJsonLoose<{ items?: ChecklistItem[] }>(raw);
    const items = (parsed?.items ?? []).filter((i) => i && typeof i.label === "string" && i.label.trim());
    if (items.length >= 4) {
      return items.slice(0, 16).map((i, idx) => ({
        id: (i.id && String(i.id).replace(/[^a-z0-9-]/gi, "-")) || `item-${idx}`,
        label: i.label,
        detail: i.detail ?? "",
      }));
    }
  } catch {
    // fall through to the standard municipal baseline
  }
  return BASELINE_CHECKLIST;
}
