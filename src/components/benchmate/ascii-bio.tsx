"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  ASCII_CLIPS,
  clipForContext,
  type AsciiClipId,
  type AsciiContext,
} from "@/lib/ascii/frames";

export function AsciiBio({
  clip,
  context = "idle",
  className,
  compact,
  showLabel = true,
}: {
  clip?: AsciiClipId;
  context?: AsciiContext;
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
  const [fade, setFade] = useState(true);
  const safeFrame = frame % data.frames.length;

  useEffect(() => {
    if (context !== "rotate") return;
    const id = window.setInterval(() => setRotateTick((t) => t + 1), 2800);
    return () => window.clearInterval(id);
  }, [context]);

  useEffect(() => {
    let fadeTimer = 0;
    const id = window.setInterval(() => {
      setFade(false);
      fadeTimer = window.setTimeout(() => {
        setFrame((f) => f + 1);
        setFade(true);
      }, 40);
    }, data.intervalMs);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(fadeTimer);
    };
  }, [data.intervalMs, data.frames.length]);

  return (
    <div
      className={cn(
        "ascii-bio select-none font-mono text-accent/90",
        compact ? "text-[9px] leading-[1.1]" : "text-[11px] leading-[1.15] sm:text-xs",
        className,
      )}
      data-testid={`ascii-bio-${resolvedId}`}
      data-clip={resolvedId}
      data-interval-ms={data.intervalMs}
      aria-hidden
    >
      {showLabel && (
        <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {data.label}
        </p>
      )}
      <pre
        className={cn(
          "min-h-[5.5em] overflow-hidden whitespace-pre transition-opacity duration-75",
          fade ? "opacity-100" : "opacity-70",
        )}
      >
        {data.frames[safeFrame]}
      </pre>
    </div>
  );
}

/** Inline loader strip for agent-working / Wonder-thinking states */
export function AsciiLoader({
  context,
  status,
  className,
  thinking,
}: {
  context: AsciiContext;
  status?: string;
  className?: string;
  /** Prefer phage clip for Wonder-dispatch thinking */
  thinking?: boolean;
}) {
  const resolved: AsciiContext = thinking ? "think" : context;
  return (
    <div
      className={cn(
        "flex items-start gap-4 border border-border/60 bg-card/40 px-4 py-3 animate-in fade-in duration-500",
        className,
      )}
      data-testid="ascii-loader"
      data-context={resolved}
      role="status"
    >
      <AsciiBio context={resolved} compact showLabel={false} />
      <div className="min-w-0 flex-1 pt-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
          {thinking || resolved === "think" ? "wonder thinking" : "agent working"}
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
