"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const STAGES = [
  { id: "upload", label: "upload" },
  { id: "extract", label: "vision" },
  { id: "compute", label: "tools" },
  { id: "verify", label: "verify" },
  { id: "report", label: "report" },
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
      className="flex flex-wrap items-center gap-1 md:gap-2"
      data-testid="pipeline-progress"
      aria-label="Pipeline progress"
    >
      {STAGES.map((stage, idx) => {
        const complete = idx <= doneIdx;
        const current = idx === activeIdx;
        return (
          <li key={stage.id} className="flex items-center gap-1 md:gap-2">
            <div
              className={cn(
                "flex items-center gap-2 border px-2.5 py-1 font-mono text-xs transition-all duration-500",
                complete && "border-accent/50 bg-accent/10 text-accent",
                current &&
                  !complete &&
                  "border-accent text-accent shadow-[0_0_0_1px_oklch(0.88_0.19_125/0.25)]",
                !complete && !current && "border-border/60 text-muted-foreground",
              )}
              data-active={current ? "true" : "false"}
              data-complete={complete ? "true" : "false"}
            >
              <span
                className={cn(
                  "flex size-4 items-center justify-center text-[10px]",
                  complete ? "text-accent" : current ? "text-accent" : "text-muted-foreground",
                )}
              >
                {complete ? <Check className="size-3" /> : idx + 1}
              </span>
              <span className="tracking-wide">{stage.label}</span>
            </div>
            {idx < STAGES.length - 1 && (
              <div
                className={cn(
                  "hidden h-px w-5 sm:block md:w-8",
                  idx < activeIdx ? "bg-accent/60" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
