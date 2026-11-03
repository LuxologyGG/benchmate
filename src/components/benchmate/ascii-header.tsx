"use client";

import { cn } from "@/lib/utils";
import {
  FIGLET_BENCHMATE,
  FIGLET_BENCHMATE_SM,
  FIGLET_SECTIONS,
  type FigletSection,
} from "@/lib/ascii/figlet";

export function FigletWordmark({
  size = "lg",
  className,
}: {
  size?: "sm" | "lg";
  className?: string;
}) {
  const art = size === "sm" ? FIGLET_BENCHMATE_SM : FIGLET_BENCHMATE;
  return (
    <pre
      className={cn(
        "figlet-wordmark overflow-x-auto whitespace-pre font-mono leading-[1.05] text-accent",
        size === "lg"
          ? "text-[7px] sm:text-[9px] md:text-[11px] lg:text-xs"
          : "text-[6px] sm:text-[7px] md:text-[8px]",
        className,
      )}
      data-testid="figlet-wordmark"
      aria-label="BenchMate"
    >
      {art}
    </pre>
  );
}

export function FigletSectionTitle({
  section,
  className,
}: {
  section: FigletSection;
  className?: string;
}) {
  return (
    <pre
      className={cn(
        "overflow-x-auto whitespace-pre font-mono text-[8px] leading-[1.1] text-foreground/80 sm:text-[9px]",
        className,
      )}
      data-testid={`figlet-section-${section}`}
      aria-hidden
    >
      {FIGLET_SECTIONS[section]}
    </pre>
  );
}
