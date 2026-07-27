import type { Requirement } from "./schemas";
import { citationSentence, type HudFinding } from "../hud";

export type CoverageStatus = "covered" | "partial" | "missing";

export interface EvidenceLink {
  /** Question id, or "hud" / "manual" for non-question evidence. */
  questionId: string;
  label: string;
  excerpt: string;
}

export interface Coverage {
  requirement: Requirement;
  status: CoverageStatus;
  evidence: EvidenceLink[];
  /** Checklist document labels that prove this requirement. */
  documents: string[];
  note: string;
}

export const COVERAGE_LABELS: Record<CoverageStatus, string> = {
  covered: "Covered",
  partial: "Thin",
  missing: "Not addressed",
};

const HUD_TRIGGERS = [
  "low- and moderate",
  "low and moderate",
  "low-mod",
  "lowmod",
  "lmi",
  "low-income",
  "low income",
  "opportunity zone",
  "distressed",
  "poverty",
  "disadvantaged",
  "area benefit",
];

function excerpt(text: string, length = 180) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > length ? `${clean.slice(0, length)}…` : clean;
}

export function evaluateCoverage(params: {
  requirements: Requirement[];
  questions: { id: string; label: string }[];
  answers: Record<string, string>;
  manualEvidence?: Record<string, string>;
  hudFindings?: HudFinding[];
  checklist?: { id: string; label: string; documentName?: string; requirementIds?: string[] }[];
}): Coverage[] {
  const { requirements, questions, answers, manualEvidence = {}, hudFindings = [], checklist = [] } = params;

  return requirements.map((requirement) => {
    const evidence: EvidenceLink[] = [];
    const seen = new Set<string>();

    const push = (questionId: string, label: string, text: string) => {
      if (!text.trim() || seen.has(questionId)) return;
      seen.add(questionId);
      evidence.push({ questionId, label, excerpt: excerpt(text) });
    };

    for (const questionId of requirement.questionIds ?? []) {
      const question = questions.find((q) => q.id === questionId);
      if (question) push(question.id, question.label, answers[question.id] ?? "");
    }

    const keywords = (requirement.keywords ?? []).map((k) => k.toLowerCase()).filter((k) => k.length > 3);
    if (keywords.length > 0) {
      for (const question of questions) {
        const answer = answers[question.id] ?? "";
        const haystack = answer.toLowerCase();
        if (answer.trim() && keywords.some((k) => haystack.includes(k))) {
          push(question.id, question.label, answer);
        }
      }
    }

    const manual = manualEvidence[requirement.id] ?? "";
    if (manual.trim()) push("manual", "Evidence you added here", manual);

    const needsHud = HUD_TRIGGERS.some(
      (t) =>
        requirement.label.toLowerCase().includes(t) ||
        requirement.quote.toLowerCase().includes(t) ||
        keywords.some((k) => k.includes(t)),
    );
    if (needsHud && hudFindings.length > 0) {
      const finding = hudFindings[hudFindings.length - 1];
      push("hud", "HUD data check", citationSentence(finding));
    }

    const documents = checklist
      .filter((c) => (c.requirementIds ?? []).includes(requirement.id))
      .map((c) => c.documentName || c.label);

    const totalLength = evidence.reduce((sum, e) => sum + e.excerpt.length, 0);
    const hasBlank = evidence.some((e) => /\[[^\]]{3,}\]/.test(e.excerpt));

    let status: CoverageStatus;
    if (evidence.length === 0) status = "missing";
    else if (totalLength < 120 || hasBlank) status = "partial";
    else status = "covered";

    let note = "";
    if (status === "missing") {
      note = needsHud && hudFindings.length === 0
        ? "Nothing in your answers speaks to this. Run the HUD check below, or add the evidence directly."
        : "Nothing in your answers speaks to this yet.";
    } else if (status === "partial") {
      note = hasBlank
        ? "Your evidence still contains a blank that has to be filled in."
        : "There is something here, but it is too thin for a reviewer to score.";
    } else {
      note = "A reviewer can find this in your answers.";
    }

    return { requirement, status, evidence, documents, note };
  });
}

export function coverageStats(coverage: Coverage[]) {
  const covered = coverage.filter((c) => c.status === "covered").length;
  const partial = coverage.filter((c) => c.status === "partial").length;
  const missing = coverage.filter((c) => c.status === "missing").length;
  const total = coverage.length || 1;
  return {
    covered,
    partial,
    missing,
    total: coverage.length,
    percent: Math.round(((covered + partial * 0.5) / total) * 100),
    blockers: coverage.filter((c) => c.requirement.blocking && c.status !== "covered"),
  };
}
