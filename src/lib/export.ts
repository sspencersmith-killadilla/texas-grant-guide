import type { SavedDraft } from "./local-drafts";

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
