import { findPlaceholders, DOCUMENT_STATUS_LABELS, type SavedDraft } from "./local-drafts";
import { coverageStats, evaluateCoverage, COVERAGE_LABELS } from "./grants/evidence";
import { citationSentence, HUD_SOURCE_NOTE } from "./hud";
import { DRAFT_QUESTIONS } from "./questions";

function fileBase(draft: SavedDraft) {
  return draft.grantTitle
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .toLowerCase();
}

function paragraphs(body: string) {
  return body
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Submission-prep pages appended after the narrative. */
function appendixLines(draft: SavedDraft): { heading: string; items: string[] }[] {
  const blocks: { heading: string; items: string[] }[] = [];

  if (draft.requirements.length > 0) {
    const questions = [
      ...DRAFT_QUESTIONS.map((q) => ({ id: q.id, label: q.label })),
      ...draft.extraQuestions.map((q) => ({ id: q.id, label: q.label })),
    ];
    const coverage = evaluateCoverage({
      requirements: draft.requirements,
      questions,
      answers: draft.answers,
      manualEvidence: draft.manualEvidence,
      hudFindings: draft.hudFindings,
      checklist: draft.checklist,
    });
    const stats = coverageStats(coverage);
    blocks.push({
      heading: `Requirement coverage (${stats.covered} of ${stats.total} covered)`,
      items: coverage.flatMap((c) => [
        `${COVERAGE_LABELS[c.status].toUpperCase()}${c.requirement.blocking ? " (make or break)" : ""} — ${c.requirement.label}`,
        `    Evidence: ${c.evidence.length ? c.evidence.map((e) => e.label).join("; ") : "none yet"}`,
        ...(c.documents.length ? [`    Documents: ${c.documents.join("; ")}`] : []),
      ]),
    });
  }

  if (draft.hudFindings.length > 0) {
    blocks.push({
      heading: "HUD low-income and Opportunity Zone findings",
      items: [...draft.hudFindings.map((f) => citationSentence(f)), `Source: ${HUD_SOURCE_NOTE}`],
    });
  }

  const placeholders = findPlaceholders(draft.sections);
  if (placeholders.length > 0) {
    blocks.push({
      heading: "Before you submit: blanks to fill in",
      items: placeholders.map((p) => `[${p}]`),
    });
  }

  if (draft.checklist.length > 0) {
    blocks.push({
      heading: "Document request packet",
      items: draft.checklist.flatMap((c) => [
        `${c.done ? "[x]" : "[ ]"} ${c.documentName || c.label}${c.required === false ? " (if applicable)" : ""}`,
        `    Status: ${DOCUMENT_STATUS_LABELS[c.status]}${c.source ? ` · From: ${c.source}` : ""}${c.format ? ` · Format: ${c.format}` : ""}${c.location ? ` · Location: ${c.location}` : ""}`,
        ...(c.detail ? [`    ${c.detail}`] : []),
      ]),
    });
  }

  if (draft.scorecard) {
    const gaps = draft.scorecard.gaps.map((g) => `${g.issue}${g.fix ? ` — ${g.fix}` : ""}`);
    blocks.push({
      heading: `Reviewer scorecard (${draft.scorecard.overall}/100)`,
      items: [
        draft.scorecard.summary,
        ...draft.scorecard.criteria.map((c) => `${c.name}: ${c.score}/10 — ${c.comment}`),
        ...(gaps.length ? ["Gaps to close:", ...gaps] : []),
      ].filter(Boolean),
    });
  }

  return blocks;
}



export async function downloadDocx(draft: SavedDraft) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import("docx");

  const children: InstanceType<typeof Paragraph>[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: draft.grantTitle, bold: true, size: 32 })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `${draft.grantAgency} — Application Narrative (Draft)`, size: 22, color: "555555" })],
      spacing: { after: 400 },
    }),
  ];

  for (const section of draft.sections) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: section.heading, bold: true, size: 26 })],
        spacing: { before: 320, after: 160 },
      }),
    );
    for (const p of paragraphs(section.body)) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: p, size: 22 })],
          spacing: { after: 160, line: 300 },
        }),
      );
    }
  }

  for (const block of appendixLines(draft)) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: block.heading, bold: true, size: 26 })],
        spacing: { before: 400, after: 160 },
        pageBreakBefore: true,
      }),
    );
    for (const item of block.items) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: item, size: 21 })],
          spacing: { after: 120, line: 280 },
        }),
      );
    }
  }


  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Draft generated on ${new Date(draft.updatedAt).toLocaleDateString()}. Review every bracketed placeholder and verify all figures against official program guidance at ${draft.grantUrl}`,
          italics: true,
          size: 18,
          color: "777777",
        }),
      ],
      spacing: { before: 480 },
    }),
  );

  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 22 } } } },
    sections: [
      {
        properties: {
          page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, `${fileBase(draft)}-draft.docx`);
}

export async function downloadPdf(draft: SavedDraft) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });

  const margin = 72;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  const bottom = doc.internal.pageSize.getHeight() - margin;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > bottom) {
      doc.addPage();
      y = margin;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  for (const line of doc.splitTextToSize(draft.grantTitle, width) as string[]) {
    ensureSpace(24);
    doc.text(line, margin, y);
    y += 24;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(110);
  ensureSpace(20);
  doc.text(`${draft.grantAgency} — Application Narrative (Draft)`, margin, y);
  y += 30;
  doc.setTextColor(0);

  for (const section of draft.sections) {
    ensureSpace(40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(section.heading, margin, y);
    y += 20;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    for (const p of paragraphs(section.body)) {
      for (const line of doc.splitTextToSize(p, width) as string[]) {
        ensureSpace(16);
        doc.text(line, margin, y);
        y += 16;
      }
      y += 8;
    }
    y += 8;
  }

  const blocks = appendixLines(draft);
  if (blocks.length > 0) {
    doc.addPage();
    y = margin;
    for (const block of blocks) {
      ensureSpace(40);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(block.heading, margin, y);
      y += 20;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      for (const item of block.items) {
        for (const line of doc.splitTextToSize(item, width) as string[]) {
          ensureSpace(15);
          doc.text(line, margin, y);
          y += 15;
        }
        y += 6;
      }
      y += 12;
    }
  }


  ensureSpace(40);
  doc.setFontSize(9);
  doc.setTextColor(130);
  for (const line of doc.splitTextToSize(
    `Draft generated on ${new Date(draft.updatedAt).toLocaleDateString()}. Review every bracketed placeholder and verify all figures against official program guidance at ${draft.grantUrl}`,
    width,
  ) as string[]) {
    ensureSpace(13);
    doc.text(line, margin, y);
    y += 13;
  }

  doc.save(`${fileBase(draft)}-draft.pdf`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
