export interface DraftSection {
  heading: string;
  body: string;
}

export interface SavedDraft {
  id: string;
  grantId: string;
  grantTitle: string;
  grantAgency: string;
  grantUrl: string;
  answers: Record<string, string>;
  sections: DraftSection[];
  createdAt: string;
  updatedAt: string;
}

const KEY = "muniGrantDrafts.v1";

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadDrafts(): SavedDraft[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedDraft[];
    return Array.isArray(parsed) ? parsed : [];
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
  const next = { ...draft, updatedAt: new Date().toISOString() };
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
