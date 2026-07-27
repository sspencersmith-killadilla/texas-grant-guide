import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  Download,
  FileText,
  Gauge,
  Loader2,
  RefreshCw,
  Sparkles,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  extractChecklist,
  generateDraft,
  generateGrantQuestions,
  getGrant,
  reviewDraft,
  reviseSection,
} from "@/lib/grants.functions";
import type { ExtraQuestion, Scorecard } from "@/lib/grants/schemas";
import { DRAFT_QUESTIONS } from "@/lib/questions";
import { downloadDocx, downloadPdf } from "@/lib/export";
import {
  findPlaceholders,
  getDraftForGrant,
  newDraftId,
  saveDraft,
  type SavedChecklistItem,
  type SavedDraft,
} from "@/lib/local-drafts";
import { hasUsableProfile, loadProfile, profileSummaryText, type CityProfile } from "@/lib/city-profile";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/grants/$id/draft")({
  head: () => ({
    meta: [
      { title: "Build your draft application | Texas Municipal Grant Finder" },
      {
        name: "description",
        content:
          "Answer the questions this program actually scores, then generate, review and download a first-draft grant application.",
      },
      { property: "og:title", content: "Build your draft application" },
      {
        property: "og:description",
        content: "Answer program-specific questions and generate a reviewed, downloadable first-draft application.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DraftWizard,
});

function DraftWizard() {
  const { id } = useParams({ from: "/grants/$id/draft" });
  const navigate = useNavigate();

  const grantQuery = useQuery({
    queryKey: ["grant", id],
    queryFn: () => getGrant({ data: { id } }),
    staleTime: 30 * 60 * 1000,
  });
  const grant = grantQuery.data;

  const [profile, setProfile] = useState<CityProfile | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [extraQuestions, setExtraQuestions] = useState<ExtraQuestion[]>([]);
  const [step, setStep] = useState(0);
  const [sections, setSections] = useState<SavedDraft["sections"]>([]);
  const [checklist, setChecklist] = useState<SavedChecklistItem[]>([]);
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [generating, setGenerating] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [revisingIndex, setRevisingIndex] = useState<number | null>(null);
  const [revisionText, setRevisionText] = useState<Record<number, string>>({});
  const [hydrated, setHydrated] = useState(false);

  const profileText = profile && hasUsableProfile(profile) ? profileSummaryText(profile) : undefined;

  useEffect(() => {
    const saved = loadProfile();
    setProfile(saved);

    const existing = getDraftForGrant(id);
    if (existing) {
      setDraftId(existing.id);
      setAnswers(existing.answers);
      setExtraQuestions(existing.extraQuestions);
      setSections(existing.sections);
      setChecklist(existing.checklist);
      setScorecard(existing.scorecard);
      if (existing.sections.length > 0) setStep(-1);
    } else {
      setDraftId(newDraftId());
      if (saved && hasUsableProfile(saved)) {
        setAnswers({
          applicant: `${saved.cityName}${saved.county ? `, ${saved.county} County` : ""}, Texas${
            saved.population ? `, population approximately ${saved.population.toLocaleString()}` : ""
          }.${saved.governance ? ` We are a ${saved.governance === "home-rule" ? "home-rule" : "general-law"} city.` : ""}`,
          ...(saved.capitalProjects ? { project: saved.capitalProjects } : {}),
        });
      }
    }
    setHydrated(true);
  }, [id]);

  // Program-specific questions drawn from this notice's own review criteria.
  const questionsQuery = useQuery({
    queryKey: ["grant-questions", id],
    enabled: Boolean(grant?.description) && hydrated && extraQuestions.length === 0,
    staleTime: Infinity,
    retry: false,
    queryFn: () =>
      generateGrantQuestions({
        data: {
          grantTitle: grant!.title,
          grantAgency: grant!.agency,
          grantDescription: grant!.description || grant!.title,
          grantEligibility: grant!.eligibility,
          cityProfile: profileText,
        },
      }),
  });

  useEffect(() => {
    if (questionsQuery.data?.questions?.length && extraQuestions.length === 0) {
      setExtraQuestions(questionsQuery.data.questions);
    }
  }, [questionsQuery.data, extraQuestions.length]);

  const checklistQuery = useQuery({
    queryKey: ["grant-checklist", id],
    enabled: Boolean(grant?.description) && hydrated && checklist.length === 0,
    staleTime: Infinity,
    retry: false,
    queryFn: () =>
      extractChecklist({
        data: {
          grantTitle: grant!.title,
          grantAgency: grant!.agency,
          grantDescription: grant!.description || grant!.title,
          grantEligibility: grant!.eligibility,
        },
      }),
  });

  useEffect(() => {
    if (checklistQuery.data?.items?.length && checklist.length === 0) {
      setChecklist(checklistQuery.data.items.map((i) => ({ ...i, done: false })));
    }
  }, [checklistQuery.data, checklist.length]);

  const allQuestions = useMemo(
    () => [...DRAFT_QUESTIONS.map((q) => ({ ...q, source: "core" as const })), ...extraQuestions.map((q) => ({ ...q, multiline: true, source: "program" as const }))],
    [extraQuestions],
  );

  const buildDraftRecord = (next?: Partial<SavedDraft>): SavedDraft | null => {
    if (!grant || !draftId) return null;
    return {
      id: draftId,
      grantId: grant.id,
      grantTitle: grant.title,
      grantAgency: grant.agency,
      grantUrl: grant.url,
      answers,
      extraQuestions,
      sections,
      checklist,
      scorecard,
      cityName: profile?.cityName ?? "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...next,
    };
  };

  const persist = (next?: Partial<SavedDraft>) => {
    const record = buildDraftRecord(next);
    if (record) saveDraft(record);
  };

  const answered = useMemo(
    () => allQuestions.filter((q) => (answers[q.id] ?? "").trim().length > 0).length,
    [allQuestions, answers],
  );

  const onReview = step < 0 || step >= allQuestions.length;
  const question = allQuestions[Math.min(Math.max(step, 0), allQuestions.length - 1)];
  const placeholders = useMemo(() => findPlaceholders(sections), [sections]);

  const handleGenerate = async () => {
    if (!grant) return;
    setGenerating(true);
    try {
      const result = await generateDraft({
        data: {
          grantTitle: grant.title,
          grantAgency: grant.agency,
          grantDescription: grant.description || grant.title,
          grantEligibility: grant.eligibility,
          cityProfile: profileText,
          answers: allQuestions.map((q) => ({ question: q.label, answer: answers[q.id] ?? "" })),
        },
      });
      setSections(result.sections);
      setStep(-1);
      persist({ sections: result.sections, answers });
      toast.success("Draft written and revised against the funder's criteria.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate the draft.");
    } finally {
      setGenerating(false);
    }
  };

  const handleReview = async () => {
    if (!grant || sections.length === 0) return;
    setReviewing(true);
    try {
      const result = await reviewDraft({
        data: {
          grantTitle: grant.title,
          grantAgency: grant.agency,
          grantDescription: grant.description || grant.title,
          grantEligibility: grant.eligibility,
          sections,
        },
      });
      setScorecard(result);
      persist({ scorecard: result });
      toast.success("Reviewer scorecard ready.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not review the draft.");
    } finally {
      setReviewing(false);
    }
  };

  const handleRevise = async (index: number) => {
    if (!grant) return;
    const instruction = (revisionText[index] ?? "").trim();
    if (!instruction) {
      toast.error("Tell the writer what to change in this section.");
      return;
    }
    setRevisingIndex(index);
    try {
      const result = await reviseSection({
        data: {
          grantTitle: grant.title,
          grantAgency: grant.agency,
          grantDescription: grant.description || grant.title,
          grantEligibility: grant.eligibility,
          cityProfile: profileText,
          heading: sections[index].heading,
          body: sections[index].body,
          instruction,
        },
      });
      const next = sections.map((s, i) => (i === index ? { ...s, body: result.body } : s));
      setSections(next);
      setRevisionText((prev) => ({ ...prev, [index]: "" }));
      persist({ sections: next });
      toast.success(`${sections[index].heading} rewritten.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not rewrite that section.");
    } finally {
      setRevisingIndex(null);
    }
  };

  const currentDraft = buildDraftRecord();

  if (grantQuery.isLoading || !hydrated) {
    return (
      <Shell>
        <div className="h-64 animate-pulse border border-border bg-card" />
      </Shell>
    );
  }

  if (!grant) {
    return (
      <Shell>
        <div className="border border-border bg-card p-10 text-center">
          <h1 className="text-xl font-semibold">Grant not found</h1>
          <Button asChild className="mt-5 rounded-sm">
            <Link to="/">Back to all grants</Link>
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <Link
        to="/grants/$id"
        params={{ id }}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to grant details
      </Link>

      <header className="border border-border bg-card p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Draft application</p>
        <h1 className="mt-2 text-2xl font-bold leading-tight">{grant.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{grant.agency}</p>
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{onReview ? "Draft generated" : `Question ${step + 1} of ${allQuestions.length}`}</span>
            <span>
              {answered} of {allQuestions.length} answered
            </span>
          </div>
          <Progress value={onReview ? 100 : (step / allQuestions.length) * 100} className="h-1.5" />
        </div>
        {!profileText ? (
          <p className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
            <AlertTriangle className="size-3.5 text-soon" />
            Fill in your{" "}
            <Link to="/profile" className="underline">
              city profile
            </Link>{" "}
            first and these answers get pre-filled with your population, services and match capacity.
          </p>
        ) : null}
      </header>

      {!onReview ? (
        <section className="mt-6 border border-border bg-card p-6 sm:p-8">
          {question.source === "program" ? (
            <p className="mb-3 inline-flex items-center gap-1.5 border border-accent/40 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-widest text-accent">
              <Sparkles className="size-3" /> Asked by this program
            </p>
          ) : null}
          <h2 className="text-lg font-semibold">{question.label}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{question.helper}</p>
          <Textarea
            value={answers[question.id] ?? ""}
            onChange={(e) => setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))}
            onBlur={() => persist({ answers })}
            placeholder={question.placeholder}
            rows={8}
            className="mt-4 rounded-sm text-base"
          />

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="outline"
              className="rounded-sm"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              <ArrowLeft className="size-4" /> Previous
            </Button>

            <div className="flex flex-wrap items-center gap-2">
              {questionsQuery.isLoading ? (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> Reading this program's review criteria…
                </span>
              ) : null}
              {step === allQuestions.length - 1 ? (
                <Button
                  className="rounded-sm bg-accent text-accent-foreground hover:bg-accent/90"
                  onClick={handleGenerate}
                  disabled={generating || answered === 0}
                >
                  {generating ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                  {generating ? "Writing and revising…" : "Generate first draft"}
                </Button>
              ) : (
                <Button
                  className="rounded-sm"
                  onClick={() => {
                    persist({ answers });
                    setStep((s) => s + 1);
                  }}
                >
                  Next <ArrowRight className="size-4" />
                </Button>
              )}
            </div>
          </div>

          <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
            Answers are saved in this browser only. Nothing is stored on a server except during the moment the draft is
            written.
          </p>
        </section>
      ) : (
        <section className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3 border border-border bg-card p-5">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Check className="size-4 text-open" /> Your first draft is ready and saved locally.
            </p>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button
                className="rounded-sm bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={handleReview}
                disabled={reviewing}
              >
                {reviewing ? <Loader2 className="size-4 animate-spin" /> : <Gauge className="size-4" />}
                {reviewing ? "Scoring…" : scorecard ? "Re-score draft" : "Score like a reviewer"}
              </Button>
              <Button variant="outline" className="rounded-sm" onClick={() => currentDraft && downloadDocx(currentDraft)}>
                <Download className="size-4" /> Word
              </Button>
              <Button variant="outline" className="rounded-sm" onClick={() => currentDraft && downloadPdf(currentDraft)}>
                <Download className="size-4" /> PDF
              </Button>
              <Button variant="ghost" className="rounded-sm" onClick={() => setStep(0)}>
                <RefreshCw className="size-4" /> Edit answers
              </Button>
            </div>
          </div>

          {scorecard ? <ScorecardPanel scorecard={scorecard} /> : null}

          {placeholders.length > 0 ? (
            <div className="border border-soon/50 bg-card p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="size-4 text-soon" /> {placeholders.length} blank
                {placeholders.length === 1 ? "" : "s"} still to fill in
              </h2>
              <ul className="mt-3 grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
                {placeholders.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 bg-soon" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {checklist.length > 0 ? (
            <div className="border border-border bg-card p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <ClipboardList className="size-4 text-accent" /> Documents and registrations to gather
              </h2>
              <ul className="mt-3 space-y-2">
                {checklist.map((item, i) => (
                  <li key={item.id} className="flex gap-3 border-b border-border pb-2 last:border-0 last:pb-0">
                    <Checkbox
                      checked={item.done}
                      className="mt-0.5 rounded-[2px]"
                      onCheckedChange={() => {
                        const next = checklist.map((c, idx) => (idx === i ? { ...c, done: !c.done } : c));
                        setChecklist(next);
                        persist({ checklist: next });
                      }}
                    />
                    <div>
                      <p className={cn("text-sm font-medium", item.done && "text-muted-foreground line-through")}>
                        {item.label}
                      </p>
                      {item.detail ? <p className="text-xs text-muted-foreground">{item.detail}</p> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {sections.map((section, i) => (
            <article key={section.heading + i} className="border border-border bg-card p-6">
              <h2 className="text-base font-semibold">{section.heading}</h2>
              <Textarea
                value={section.body}
                rows={Math.min(20, Math.max(6, Math.round(section.body.length / 90)))}
                onChange={(e) => {
                  const next = sections.map((s, idx) => (idx === i ? { ...s, body: e.target.value } : s));
                  setSections(next);
                }}
                onBlur={() => persist({ sections })}
                className="mt-3 rounded-sm border-transparent bg-transparent px-0 text-sm leading-relaxed focus-visible:border-border focus-visible:px-3"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <Input
                  value={revisionText[i] ?? ""}
                  onChange={(e) => setRevisionText((prev) => ({ ...prev, [i]: e.target.value }))}
                  placeholder="Ask for a change: make it shorter, add the flood history, emphasize the match…"
                  className="h-9 flex-1 rounded-sm text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-sm"
                  onClick={() => handleRevise(i)}
                  disabled={revisingIndex === i}
                >
                  {revisingIndex === i ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
                  Rewrite
                </Button>
              </div>
            </article>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-surface p-5">
            <p className="text-xs text-muted-foreground">
              This is a starting point, not a submission. Replace every [bracketed placeholder], verify figures, and
              follow the official application instructions.
            </p>
            <Button variant="outline" className="rounded-sm" onClick={() => navigate({ to: "/drafts" })}>
              View all my drafts
            </Button>
          </div>
        </section>
      )}
    </Shell>
  );
}

function ScorecardPanel({ scorecard }: { scorecard: Scorecard }) {
  return (
    <div className="border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex size-16 shrink-0 flex-col items-center justify-center border border-accent">
          <span className="text-xl font-bold leading-none">{scorecard.overall}</span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">/ 100</span>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Reviewer scorecard</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{scorecard.summary}</p>
        </div>
      </div>

      {scorecard.criteria.length > 0 ? (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {scorecard.criteria.map((c) => (
            <li key={c.name}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.score}/10</span>
              </div>
              <Progress value={c.score * 10} className="mt-1.5 h-1" />
              <p className="mt-1 text-xs text-muted-foreground">{c.comment}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {scorecard.gaps.length > 0 ? (
        <div className="mt-5 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">Fix these before you submit</h3>
          <ol className="mt-3 space-y-3">
            {scorecard.gaps.map((gap, i) => (
              <li key={i} className="border-l-2 border-urgent pl-3">
                <p className="text-sm font-medium">{gap.issue}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {gap.section ? <span className="font-medium">{gap.section}: </span> : null}
                  {gap.fix}
                </p>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">{children}</main>
    </div>
  );
}
