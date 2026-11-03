"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  ASCII_CLIPS,
  clipForContext,
  type AsciiClipId,
} from "@/lib/ascii/frames";

type Context = "idle" | "extract" | "compute" | "verify" | "report" | "rotate";

export function AsciiBio({
  clip,
  context = "idle",
  className,
  compact,
  showLabel = true,
}: {
  clip?: AsciiClipId;
  context?: Context;
  className?: string;
  compact?: boolean;
  showLabel?: boolean;
}) {
  const [rotateTick, setRotateTick] = useState(0);
  const resolvedId =
    clip ??
    clipForContext(context === "rotate" ? "rotate" : context, rotateTick);
  const data = ASCII_CLIPS[resolvedId];
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (context !== "rotate") return;
    const id = window.setInterval(() => setRotateTick((t) => t + 1), 3200);
    return () => window.clearInterval(id);
  }, [context]);

  useEffect(() => {
    setFrame(0);
    const id = window.setInterval(() => {
      setFrame((f) => (f + 1) % data.frames.length);
    }, data.intervalMs);
    return () => window.clearInterval(id);
  }, [data]);

  return (
    <div
      className={cn(
        "ascii-bio select-none font-mono text-accent/90",
        compact ? "text-[9px] leading-[1.1]" : "text-[11px] leading-[1.15] sm:text-xs",
        className,
      )}
      data-testid={`ascii-bio-${resolvedId}`}
      data-clip={resolvedId}
      aria-hidden
    >
      {showLabel && (
        <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {data.label}
        </p>
      )}
      <pre className="overflow-hidden whitespace-pre">{data.frames[frame]}</pre>
    </div>
  );
}

/** Inline loader strip for agent-working states */
export function AsciiLoader({
  context,
  status,
  className,
}: {
  context: Context;
  status?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-4 border border-border/60 bg-card/40 px-4 py-3 animate-in fade-in duration-500",
        className,
      )}
      data-testid="ascii-loader"
      role="status"
    >
      <AsciiBio context={context} compact showLabel={false} />
      <div className="min-w-0 flex-1 pt-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
          agent working
        </p>
        {status && (
          <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
            {status}
          </p>
        )}
        <span className="mt-2 inline-block h-3 w-[2px] animate-pulse bg-accent" />
      </div>
    </div>
  );
}
