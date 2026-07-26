import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Download, FileText, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { getGrant, generateDraft } from "@/lib/grants.functions";
import { DRAFT_QUESTIONS } from "@/lib/questions";
import { downloadDocx, downloadPdf } from "@/lib/export";
import { getDraftForGrant, newDraftId, saveDraft, type SavedDraft } from "@/lib/local-drafts";

export const Route = createFileRoute("/grants/$id/draft")({
  head: () => ({
    meta: [
      { title: "Build your draft application | Texas Municipal Grant Finder" },
      {
        name: "description",
        content: "Answer eight questions about your project and generate a downloadable first-draft grant application.",
      },
      { property: "og:title", content: "Build your draft application" },
      {
        property: "og:description",
        content: "Answer eight questions and generate a downloadable first-draft grant application for your city.",
      },
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

  const [draftId, setDraftId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [sections, setSections] = useState<SavedDraft["sections"]>([]);
  const [generating, setGenerating] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const existing = getDraftForGrant(id);
    if (existing) {
      setDraftId(existing.id);
      setAnswers(existing.answers);
      setSections(existing.sections);
      if (existing.sections.length > 0) setStep(DRAFT_QUESTIONS.length);
    } else {
      setDraftId(newDraftId());
    }
    setHydrated(true);
  }, [id]);

  const persist = (next: Partial<SavedDraft>) => {
    if (!grant || !draftId) return;
    saveDraft({
      id: draftId,
      grantId: grant.id,
      grantTitle: grant.title,
      grantAgency: grant.agency,
      grantUrl: grant.url,
      answers,
      sections,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...next,
    });
  };

  const answered = useMemo(
    () => DRAFT_QUESTIONS.filter((q) => (answers[q.id] ?? "").trim().length > 0).length,
    [answers],
  );

  const onReview = step >= DRAFT_QUESTIONS.length;
  const question = DRAFT_QUESTIONS[Math.min(step, DRAFT_QUESTIONS.length - 1)];

  const handleGenerate = async () => {
    if (!grant) return;
    setGenerating(true);
    try {
      const result = await generateDraft({
        data: {
          grantTitle: grant.title,
          grantAgency: grant.agency,
          grantDescription: grant.description || grant.title,
          answers: DRAFT_QUESTIONS.map((q) => ({ question: q.label, answer: answers[q.id] ?? "" })),
        },
      });
      setSections(result.sections);
      setStep(DRAFT_QUESTIONS.length);
      persist({ sections: result.sections, answers });
      toast.success("Draft ready. Review it and edit anything before downloading.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate the draft.");
    } finally {
      setGenerating(false);
    }
  };

  const currentDraft: SavedDraft | null =
    grant && draftId
      ? {
          id: draftId,
          grantId: grant.id,
          grantTitle: grant.title,
          grantAgency: grant.agency,
          grantUrl: grant.url,
          answers,
          sections,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      : null;

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
            <span>
              {onReview ? "Draft generated" : `Question ${step + 1} of ${DRAFT_QUESTIONS.length}`}
            </span>
            <span>{answered} of {DRAFT_QUESTIONS.length} answered</span>
          </div>
          <Progress value={onReview ? 100 : (step / DRAFT_QUESTIONS.length) * 100} className="h-1.5" />
        </div>
      </header>

      {!onReview ? (
        <section className="mt-6 border border-border bg-card p-6 sm:p-8">
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

            {step === DRAFT_QUESTIONS.length - 1 ? (
              <Button
                className="rounded-sm bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={handleGenerate}
                disabled={generating || answered === 0}
              >
                {generating ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                {generating ? "Writing your draft…" : "Generate first draft"}
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
                variant="outline"
                className="rounded-sm"
                onClick={() => currentDraft && downloadDocx(currentDraft)}
              >
                <Download className="size-4" /> Word (.docx)
              </Button>
              <Button
                variant="outline"
                className="rounded-sm"
                onClick={() => currentDraft && downloadPdf(currentDraft)}
              >
                <Download className="size-4" /> PDF
              </Button>
              <Button variant="ghost" className="rounded-sm" onClick={() => setStep(0)}>
                <RefreshCw className="size-4" /> Edit answers
              </Button>
            </div>
          </div>

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

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">{children}</main>
    </div>
  );
}
