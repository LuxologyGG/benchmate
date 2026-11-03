import { NextResponse } from "next/server";
import { buildDocxBlob } from "@/lib/export/docx";
import { reportFileStem } from "@/lib/export/filename";
import { buildPdfBlob } from "@/lib/export/pdf";
import type { AgentResult, LabReport } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      format: "pdf" | "docx" | "md";
      report: LabReport;
      agent?: AgentResult;
    };

    if (!body.report || !body.format) {
      return NextResponse.json(
        { error: "report and format required" },
        { status: 400 },
      );
    }

    const safeName = reportFileStem(body.report.title);

    if (body.format === "md") {
      return new NextResponse(body.report.markdown, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${safeName}.md"`,
        },
      });
    }

    if (body.format === "pdf") {
      const blob = buildPdfBlob(body.report, body.agent);
      const buf = Buffer.from(await blob.arrayBuffer());
      return new NextResponse(buf, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
        },
      });
    }

    const blob = await buildDocxBlob(body.report, body.agent);
    const buf = Buffer.from(await blob.arrayBuffer());
    return new NextResponse(buf, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${safeName}.docx"`,
      },
    });
  } catch (err) {
    console.error("export error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Export failed" },
      { status: 500 },
    );
  }
}
