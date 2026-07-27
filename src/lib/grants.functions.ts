import { createServerFn } from "@tanstack/react-start";

import {
  checklistSchema,
  draftSchema,
  extraQuestionsSchema,
  hudLocationSchema,
  hudPlaceSchema,
  requirementsSchema,
  reviewSchema,
  reviseSchema,
  summarySchema,
  type ChecklistItem,
  type DraftSection,
  type ExtraQuestion,
  type Requirement,
  type Scorecard,
} from "./grants/schemas";
import { z } from "zod";
import type { Grant, PlainSummary } from "./grants/types";
import type { GrantListing } from "./grants/registry.server";
import type { HudPlaceFinding, HudTractFinding } from "./hud";

export type { DraftSection, ExtraQuestion, ChecklistItem, Scorecard, Requirement };

export const listGrants = createServerFn({ method: "GET" }).handler(async (): Promise<GrantListing> => {
  const { loadAllGrants } = await import("./grants/registry.server");
  return loadAllGrants();
});

export const getGrant = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }): Promise<Grant | null> => {
    const { loadGrantById } = await import("./grants/registry.server");
    return loadGrantById(data.id);
  });

export const summarizeGrant = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => summarySchema.parse(data))
  .handler(async ({ data }): Promise<PlainSummary> => {
    const { buildPlainSummary } = await import("./grants/drafting.server");
    return buildPlainSummary(data);
  });

export const generateGrantQuestions = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => extraQuestionsSchema.parse(data))
  .handler(async ({ data }): Promise<{ questions: ExtraQuestion[] }> => {
    const { buildExtraQuestions } = await import("./grants/drafting.server");
    return { questions: await buildExtraQuestions(data) };
  });

export const extractRequirements = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => requirementsSchema.parse(data))
  .handler(async ({ data }): Promise<{ requirements: Requirement[] }> => {
    const { buildRequirements } = await import("./grants/drafting.server");
    return { requirements: await buildRequirements(data) };
  });

export const generateDraft = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => draftSchema.parse(data))
  .handler(async ({ data }): Promise<{ sections: DraftSection[] }> => {
    const { buildDraft } = await import("./grants/drafting.server");
    return { sections: await buildDraft(data) };
  });

export const reviewDraft = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => reviewSchema.parse(data))
  .handler(async ({ data }): Promise<Scorecard> => {
    const { buildReview } = await import("./grants/drafting.server");
    return buildReview(data);
  });

export const reviseSection = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => reviseSchema.parse(data))
  .handler(async ({ data }): Promise<{ body: string }> => {
    const { buildRevision } = await import("./grants/drafting.server");
    return { body: await buildRevision(data) };
  });

export const extractChecklist = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => checklistSchema.parse(data))
  .handler(async ({ data }): Promise<{ items: ChecklistItem[] }> => {
    const { buildChecklist } = await import("./grants/drafting.server");
    return { items: await buildChecklist(data) };
  });

export const hudLookupCity = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => hudPlaceSchema.parse(data))
  .handler(async ({ data }): Promise<HudPlaceFinding> => {
    const { lookupPlace } = await import("./grants/hud.server");
    return lookupPlace(data.city, data.state ?? "TX");
  });

export const hudLookupLocation = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => hudLocationSchema.parse(data))
  .handler(async ({ data }): Promise<HudTractFinding> => {
    const { lookupLocation } = await import("./grants/hud.server");
    return lookupLocation(data.location);
  });
