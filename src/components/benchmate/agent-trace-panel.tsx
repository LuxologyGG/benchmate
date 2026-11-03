"use client";

import { cn } from "@/lib/utils";
import type { AgentRole, ProtocolDeviation, TraceEvent } from "@/lib/types";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

const ROLE_META: Record<AgentRole, { label: string; prefix: string }> = {
  orchestrator: { label: "wonder", prefix: "::" },
  sam_quantifier: { label: "sam_3.1", prefix: "→" },
  spark_readout: { label: "spark", prefix: "→" },
  calc_agent: { label: "calc", prefix: "→" },
  verifier: { label: "verifier", prefix: "←" },
  critic: { label: "critic", prefix: "←" },
  protocol_check: { label: "protocol", prefix: "!" },
  report_writer: { label: "report", prefix: "##" },
};

function kindClass(kind: TraceEvent["kind"]): string {
  switch (kind) {
    case "protocol_deviation":
      return "text-destructive";
    case "disagreement":
      return "text-accent";
    case "resolution":
      return "text-accent";
    case "error":
      return "text-destructive";
    case "done":
      return "text-accent";
    case "tool_call":
      return "text-accent";
    default:
      return "text-foreground/85";
  }
}

function formatTs(iso: string | undefined, index: number): string {
  if (iso) {
    try {
      return new Date(iso).toISOString().slice(11, 19);
    } catch {
      /* fall through */
    }
  }
  const s = index;
  const d = new Date(0, 0, 0, 0, 0, s);
  return d.toTimeString().slice(0, 8);
}

export function AgentTracePanel({
  events,
  running,
  deviations,
}: {
  events: TraceEvent[];
  running?: boolean;
  deviations?: ProtocolDeviation[];
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [events.length]);

  return (
    <div
      className="overflow-hidden border border-border/70 bg-[#070708] animate-in fade-in duration-500"
      data-testid="agent-trace-panel"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
            agent_trace
          </p>
          {running && (
            <Loader2 className="size-3.5 animate-spin text-accent" aria-label="Running" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono text-[10px]">
            muse-wonder-1.0
          </Badge>
          <span className="font-mono text-[10px] text-muted-foreground">
            {events.length} steps
          </span>
        </div>
      </div>

      {deviations && deviations.length > 0 && (
        <div
          className="flex items-start gap-2 border-b border-destructive/40 bg-destructive/10 px-4 py-3"
          data-testid="protocol-deviation-banner"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-mono text-sm text-destructive">
              PROTOCOL DEVIATION
              {deviations[0].factor ? ` · ${deviations[0].factor}×` : ""}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{deviations[0].message}</p>
          </div>
        </div>
      )}

      <ScrollArea className="h-[min(420px,50vh)]">
        <ol className="space-y-0.5 p-3 font-mono text-[11px] leading-relaxed sm:text-xs" data-testid="agent-trace-list">
          {events.length === 0 && (
            <li className="border border-dashed border-border/50 px-3 py-6 text-center text-xs text-muted-foreground">
              Trace appears here as Wonder dispatches specialists…
            </li>
          )}
          {events.map((ev, i) => {
            const meta = ROLE_META[ev.role] ?? ROLE_META.orchestrator;
            return (
              <li
                key={ev.id}
                className={cn(
                  "flex gap-2 animate-in fade-in slide-in-from-left-1 duration-300",
                  kindClass(ev.kind),
                )}
                data-kind={ev.kind}
                data-role={ev.role}
              >
                <span className="shrink-0 text-muted-foreground/70 tabular-nums">
                  {formatTs(ev.timestamp, i)}
                </span>
                <span className="shrink-0 text-muted-foreground/50">{meta.prefix}</span>
                <span className="shrink-0 text-muted-foreground">{meta.label}</span>
                <span className="min-w-0">
                  <span className="text-foreground/90">{ev.title}</span>
                  {ev.detail && (
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      {ev.detail}
                    </span>
                  )}
                </span>
                {ev.model && (
                  <span className="ml-auto hidden shrink-0 text-[10px] text-muted-foreground/50 sm:inline">
                    {ev.model}
                  </span>
                )}
              </li>
            );
          })}
          {running && (
            <li className="flex items-center gap-2 text-accent">
              <span className="opacity-50">&gt;</span>
              <span className="animate-pulse">▌</span>
            </li>
          )}
          <div ref={endRef} />
        </ol>
      </ScrollArea>

      {!running && events.some((e) => e.kind === "done") && (
        <div className="flex items-center gap-2 border-t border-border/50 px-4 py-2 font-mono text-xs text-accent">
          <CheckCircle2 className="size-3.5" />
          orchestration complete
        </div>
      )}
    </div>
  );
}
