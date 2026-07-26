import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText, Trash2 } from "lucide-react";

import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { downloadDocx, downloadPdf } from "@/lib/export";
import { deleteDraft, loadDrafts, type SavedDraft } from "@/lib/local-drafts";
import { formatDate } from "@/lib/grant-display";

export const Route = createFileRoute("/drafts")({
  head: () => ({
    meta: [
      { title: "My saved drafts | Texas Municipal Grant Finder" },
      {
        name: "description",
        content: "Grant application drafts saved privately in this browser. Reopen, edit or download them as Word or PDF.",
      },
      { property: "og:title", content: "My saved grant drafts" },
      {
        property: "og:description",
        content: "Reopen, edit or download the grant application drafts saved in this browser.",
      },
    ],
  }),
  component: DraftsPage,
});

function DraftsPage() {
  const [drafts, setDrafts] = useState<SavedDraft[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setDrafts(loadDrafts());
    setHydrated(true);
  }, []);

  const remove = (id: string) => {
    deleteDraft(id);
    setDrafts(loadDrafts());
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-2xl font-bold">My drafts</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Saved in this browser only — clearing site data removes them, and they won't follow you to another device.
        </p>

        {!hydrated ? (
          <div className="mt-8 h-32 animate-pulse border border-border bg-card" />
        ) : drafts.length === 0 ? (
          <div className="mt-8 border border-border bg-card p-10 text-center">
            <FileText className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 font-semibold">No drafts yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Find a grant your city qualifies for and answer eight questions to generate a first draft.
            </p>
            <Button asChild className="mt-5 rounded-sm bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/">Browse grants</Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {drafts.map((draft) => (
              <li key={draft.id} className="border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold leading-snug">{draft.grantTitle}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {draft.grantAgency} · updated {formatDate(draft.updatedAt)} ·{" "}
                      {draft.sections.length > 0 ? `${draft.sections.length} sections written` : "answers only"}
                    </p>
                  </div>
                  <a
                    href={draft.grantUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Official listing <ExternalLink className="size-3" />
                  </a>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild size="sm" className="rounded-sm">
                    <Link to="/grants/$id/draft" params={{ id: draft.grantId }}>
                      Open
                    </Link>
                  </Button>
                  {draft.sections.length > 0 ? (
                    <>
                      <Button size="sm" variant="outline" className="rounded-sm" onClick={() => downloadDocx(draft)}>
                        <Download className="size-3.5" /> .docx
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-sm" onClick={() => downloadPdf(draft)}>
                        <Download className="size-3.5" /> PDF
                      </Button>
                    </>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto rounded-sm text-muted-foreground hover:text-urgent"
                    onClick={() => remove(draft.id)}
                  >
                    <Trash2 className="size-3.5" /> Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
