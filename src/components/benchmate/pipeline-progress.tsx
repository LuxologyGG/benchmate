"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const STAGES = [
  { id: "upload", label: "Upload" },
  { id: "extract", label: "Vision" },
  { id: "compute", label: "Tools" },
  { id: "verify", label: "Verify" },
  { id: "report", label: "Report" },
] as const;

export type PipelineStageId = (typeof STAGES)[number]["id"];

export function PipelineProgress({
  active,
  doneThrough,
}: {
  active: PipelineStageId;
  doneThrough?: PipelineStageId | null;
}) {
  const activeIdx = STAGES.findIndex((s) => s.id === active);
  const doneIdx = doneThrough
    ? STAGES.findIndex((s) => s.id === doneThrough)
    : activeIdx - 1;

  return (
    <ol
      className="flex flex-wrap items-center gap-2 md:gap-3"
      data-testid="pipeline-progress"
      aria-label="Pipeline progress"
    >
      {STAGES.map((stage, idx) => {
        const complete = idx <= doneIdx;
        const current = idx === activeIdx;
        return (
          <li key={stage.id} className="flex items-center gap-2 md:gap-3">
            <div
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-all duration-500",
                complete && "bg-teal-700 text-white",
                current && !complete && "bg-teal-100 text-teal-900 ring-2 ring-teal-500/40",
                !complete && !current && "bg-muted text-muted-foreground",
              )}
              data-active={current ? "true" : "false"}
              data-complete={complete ? "true" : "false"}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-[11px] font-semibold",
                  complete ? "bg-white/20" : current ? "bg-teal-700 text-white" : "bg-background",
                )}
              >
                {complete ? <Check className="size-3" /> : idx + 1}
              </span>
              <span className="font-medium">{stage.label}</span>
            </div>
            {idx < STAGES.length - 1 && (
              <div
                className={cn(
                  "hidden h-px w-6 sm:block md:w-10",
                  idx < activeIdx ? "bg-teal-600" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
