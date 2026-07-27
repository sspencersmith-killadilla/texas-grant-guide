import type { ChecklistItem, DraftSection, ExtraQuestion, Requirement, Scorecard } from "./grants/schemas";
import type { HudTractFinding } from "./hud";

export type { DraftSection };

export type DocumentStatus = "not-started" | "in-progress" | "have-it" | "not-applicable";

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  "not-started": "Not started",
  "in-progress": "Requested",
  "have-it": "In hand",
  "not-applicable": "Not applicable",
};

export interface SavedChecklistItem extends ChecklistItem {
  done: boolean;
  status: DocumentStatus;
  /** Where the file lives: shared drive path, URL, or the person holding it. */
  location: string;
  /** ISO date the document is needed by. */
  dueDate: string;
}

export interface SavedDraft {
  id: string;
  grantId: string;
  grantTitle: string;
  grantAgency: string;
  grantUrl: string;
  answers: Record<string, string>;
  extraQuestions: ExtraQuestion[];
  /** Eligibility and scoring requirements read out of the notice. */
  requirements: Requirement[];
  /** Evidence typed straight into the evidence map, keyed by requirement id. */
  manualEvidence: Record<string, string>;
  /** HUD low/mod and Opportunity Zone checks run for this project. */
  hudFindings: HudTractFinding[];
  sections: DraftSection[];
  checklist: SavedChecklistItem[];
  scorecard: Scorecard | null;
  cityName: string;
  createdAt: string;
  updatedAt: string;
}

const KEY = "muniGrantDrafts.v1";

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function normalizeChecklistItem(item: Partial<SavedChecklistItem>): SavedChecklistItem {
  const done = item.done ?? item.status === "have-it";
  return {
    id: item.id ?? `item-${Math.random().toString(36).slice(2, 8)}`,
    label: item.label ?? "",
    detail: item.detail ?? "",
    documentName: item.documentName || item.label || "",
    source: item.source ?? "",
    format: item.format ?? "",
    required: item.required !== false,
    requirementIds: Array.isArray(item.requirementIds) ? item.requirementIds : [],
    done,
    status: item.status ?? (done ? "have-it" : "not-started"),
    location: item.location ?? "",
    dueDate: item.dueDate ?? "",
  };
}

function normalize(draft: Partial<SavedDraft>): SavedDraft {
  return {
    id: draft.id ?? newDraftId(),
    grantId: draft.grantId ?? "",
    grantTitle: draft.grantTitle ?? "",
    grantAgency: draft.grantAgency ?? "",
    grantUrl: draft.grantUrl ?? "",
    answers: draft.answers ?? {},
    extraQuestions: Array.isArray(draft.extraQuestions) ? draft.extraQuestions : [],
    requirements: Array.isArray(draft.requirements) ? draft.requirements : [],
    manualEvidence: draft.manualEvidence ?? {},
    hudFindings: Array.isArray(draft.hudFindings) ? draft.hudFindings : [],
    sections: Array.isArray(draft.sections) ? draft.sections : [],
    checklist: Array.isArray(draft.checklist) ? draft.checklist.map(normalizeChecklistItem) : [],
    scorecard: draft.scorecard ?? null,
    cityName: draft.cityName ?? "",
    createdAt: draft.createdAt ?? new Date().toISOString(),
    updatedAt: draft.updatedAt ?? new Date().toISOString(),
  };
}


export function loadDrafts(): SavedDraft[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<SavedDraft>[];
    return Array.isArray(parsed) ? parsed.map(normalize) : [];
  } catch {
    return [];
  }
}

function persist(drafts: SavedDraft[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(KEY, JSON.stringify(drafts));
  window.dispatchEvent(new CustomEvent("muni-drafts-changed"));
}

export function getDraftForGrant(grantId: string): SavedDraft | undefined {
  return loadDrafts().find((d) => d.grantId === grantId);
}

export function getDraft(id: string): SavedDraft | undefined {
  return loadDrafts().find((d) => d.id === id);
}

export function saveDraft(draft: SavedDraft) {
  const drafts = loadDrafts();
  const index = drafts.findIndex((d) => d.id === draft.id);
  const next = { ...normalize(draft), updatedAt: new Date().toISOString() };
  if (index >= 0) drafts[index] = next;
  else drafts.unshift(next);
  persist(drafts);
  return next;
}

export function deleteDraft(id: string) {
  persist(loadDrafts().filter((d) => d.id !== id));
}

export function newDraftId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Every unfilled [bracketed placeholder] left in the narrative. */
export function findPlaceholders(sections: DraftSection[]): string[] {
  const found = new Set<string>();
  for (const section of sections) {
    for (const match of section.body.matchAll(/\[([^\]\n]{3,120})\]/g)) {
      found.add(match[1].trim());
    }
  }
  return [...found];
}
