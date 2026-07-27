import { z } from "zod";

export interface DraftSection {
  heading: string;
  body: string;
}

export interface ExtraQuestion {
  id: string;
  label: string;
  helper: string;
  placeholder: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  detail: string;
  /** The specific document that satisfies this item. */
  documentName?: string;
  /** Who inside or outside the city produces it. */
  source?: string;
  /** Expected file/format, e.g. "Signed PDF". */
  format?: string;
  /** False when the item only applies in certain cases. */
  required?: boolean;
  /** Requirement ids in the evidence map this document proves. */
  requirementIds?: string[];
}

export type RequirementKind = "eligibility" | "mandatory" | "scoring";

export interface Requirement {
  id: string;
  label: string;
  kind: RequirementKind;
  /** Verbatim snippet from the notice this came from. */
  quote: string;
  /** What proves it, in one sentence. */
  evidenceHint: string;
  /** Ids of the wizard questions that answer this requirement. */
  questionIds: string[];
  /** Words to look for in the applicant's answers. */
  keywords: string[];
  /** True when failing this requirement disqualifies the application outright. */
  blocking: boolean;
}


export interface ScorecardCriterion {
  name: string;
  score: number;
  comment: string;
}

export interface ScorecardGap {
  issue: string;
  section: string;
  fix: string;
}

export interface Scorecard {
  overall: number;
  summary: string;
  criteria: ScorecardCriterion[];
  gaps: ScorecardGap[];
}

export const SECTION_HEADINGS = [
  "Executive Summary",
  "Statement of Need",
  "Project Description",
  "Goals and Measurable Outcomes",
  "Budget Narrative",
  "Match and Leverage",
  "Implementation Timeline",
  "Organizational Capacity and Management",
  "Evaluation Plan",
] as const;

export const grantContextSchema = z.object({
  grantTitle: z.string(),
  grantAgency: z.string(),
  grantDescription: z.string(),
  grantEligibility: z.string().optional(),
});

export const summarySchema = z.object({
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

export const answerSchema = z.object({ question: z.string(), answer: z.string() });

export const draftSchema = grantContextSchema.extend({
  cityProfile: z.string().optional(),
  answers: z.array(answerSchema).min(1),
  requirements: z.array(z.object({ label: z.string(), kind: z.string(), evidenceHint: z.string() })).optional(),
  hudNote: z.string().optional(),
});


export const extraQuestionsSchema = grantContextSchema.extend({
  cityProfile: z.string().optional(),
});

export const reviewSchema = grantContextSchema.extend({
  sections: z.array(z.object({ heading: z.string(), body: z.string() })).min(1),
});

export const reviseSchema = grantContextSchema.extend({
  heading: z.string(),
  body: z.string(),
  instruction: z.string(),
  cityProfile: z.string().optional(),
});

export const checklistSchema = grantContextSchema.extend({
  requirements: z
    .array(z.object({ id: z.string(), label: z.string() }))
    .optional(),
  closeDate: z.string().optional(),
});

export const requirementsSchema = grantContextSchema.extend({
  questions: z.array(z.object({ id: z.string(), label: z.string() })).min(1),
});

export const hudPlaceSchema = z.object({
  city: z.string().min(1),
  state: z.string().length(2).optional(),
});

export const hudLocationSchema = z.object({ location: z.string().min(3) });

