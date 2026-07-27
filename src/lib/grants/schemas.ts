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

export const checklistSchema = grantContextSchema;
