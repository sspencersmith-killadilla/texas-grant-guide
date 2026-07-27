import type { ChecklistItem, DraftSection, ExtraQuestion, Scorecard } from "./grants/schemas";

export type { DraftSection };

export interface SavedChecklistItem extends ChecklistItem {
  done: boolean;
}

export interface SavedDraft {
  id: string;
  grantId: string;
  grantTitle: string;
  grantAgency: string;
  grantUrl: string;
  answers: Record<string, string>;
  extraQuestions: ExtraQuestion[];
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

function normalize(draft: Partial<SavedDraft>): SavedDraft {
  return {
    id: draft.id ?? newDraftId(),
    grantId: draft.grantId ?? "",
    grantTitle: draft.grantTitle ?? "",
    grantAgency: draft.grantAgency ?? "",
    grantUrl: draft.grantUrl ?? "",
    answers: draft.answers ?? {},
    extraQuestions: Array.isArray(draft.extraQuestions) ? draft.extraQuestions : [],
    sections: Array.isArray(draft.sections) ? draft.sections : [],
    checklist: Array.isArray(draft.checklist) ? draft.checklist : [],
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
