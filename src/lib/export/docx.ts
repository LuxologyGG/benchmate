import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  AlignmentType,
} from "docx";
import type { AgentResult, LabReport } from "@/lib/types";

export async function buildDocxBlob(
  report: LabReport,
  agent?: AgentResult,
): Promise<Blob> {
  const sectionBlocks: Paragraph[] = [];

  const pushSection = (heading: string, body: string) => {
    sectionBlocks.push(
      new Paragraph({
        text: heading,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 120 },
      }),
    );
    for (const para of body.split(/\n\n+/)) {
      sectionBlocks.push(
        new Paragraph({
          children: [
            new TextRun({
              text: para.replace(/\*\*/g, "").replace(/`/g, ""),
              size: 22,
            }),
          ],
          spacing: { after: 120 },
        }),
      );
    }
  };

  pushSection("Introduction", report.sections.introduction);
  pushSection("Methods", report.sections.methods);
  pushSection("Data", report.sections.data);
  pushSection("Calculations", report.sections.calculations);
  pushSection("Results", report.sections.results);
  pushSection("Error Analysis", report.sections.errorAnalysis);
  pushSection("Conclusion", report.sections.conclusion);

  if (agent?.computed?.length) {
    sectionBlocks.push(
      new Paragraph({
        text: "Tool Citations",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 120 },
      }),
    );
    for (const c of agent.computed) {
      sectionBlocks.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${c.label}: ${c.value} ${c.unit} (tool: ${c.citation.toolName})`,
              size: 20,
            }),
          ],
          spacing: { after: 80 },
        }),
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: report.title,
                bold: true,
                size: 32,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [
              new TextRun({
                text: "BenchMate · Meta Global AI Developer Hackathon",
                italics: true,
                size: 18,
                color: "666666",
              }),
            ],
          }),
          ...sectionBlocks,
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}
