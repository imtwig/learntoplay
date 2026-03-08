import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Packer,
} from "docx";
import { saveAs } from "file-saver";
import type { PRDDocument } from "./prdData";

export async function downloadPRDAsDocx(prd: PRDDocument) {
  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({ text: prd.title, bold: true, size: 48, font: "Calibri" }),
      ],
    })
  );

  // Subtitle
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
      children: [
        new TextRun({ text: prd.subtitle, italics: true, size: 24, color: "666666", font: "Calibri" }),
      ],
    })
  );

  // Sections
  for (const section of prd.sections) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
        children: [
          new TextRun({ text: section.title, bold: true, size: 28, font: "Calibri" }),
        ],
      })
    );

    // Split content by newlines for proper formatting
    const lines = section.content.split("\n");
    for (const line of lines) {
      children.push(
        new Paragraph({
          spacing: { after: 100 },
          children: [
            new TextRun({ text: line, size: 22, font: "Calibri" }),
          ],
        })
      );
    }
  }

  // Generated date
  children.push(
    new Paragraph({
      spacing: { before: 600 },
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({
          text: `Generated on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
          italics: true,
          size: 18,
          color: "999999",
          font: "Calibri",
        }),
      ],
    })
  );

  const doc = new Document({
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${prd.id}-prd.docx`);
}
