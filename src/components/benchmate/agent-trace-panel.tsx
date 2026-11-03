"use client";

import { cn } from "@/lib/utils";
import type { AgentRole, ProtocolDeviation, TraceEvent } from "@/lib/types";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Cpu,
  Eye,
  FileText,
  FlaskConical,
  GitBranch,
  Loader2,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

const ROLE_META: Record<
  AgentRole,
  { label: string; icon: typeof Bot; tone: string }
> = {
  orchestrator: {
    label: "Wonder",
    icon: Sparkles,
    tone: "text-cyan-800 bg-cyan-50 border-cyan-200",
  },
  sam_quantifier: {
    label: "SAM 3.1",
    icon: Eye,
    tone: "text-violet-800 bg-violet-50 border-violet-200",
  },
  spark_readout: {
    label: "Spark",
    icon: Bot,
    tone: "text-teal-800 bg-teal-50 border-teal-200",
  },
  calc_agent: {
    label: "Calc",
    icon: Scale,
    tone: "text-sky-800 bg-sky-50 border-sky-200",
  },
  verifier: {
    label: "Verifier",
    icon: ShieldCheck,
    tone: "text-amber-900 bg-amber-50 border-amber-200",
  },
  critic: {
    label: "Critic",
    icon: GitBranch,
    tone: "text-orange-900 bg-orange-50 border-orange-200",
  },
  protocol_check: {
    label: "Protocol",
    icon: FlaskConical,
    tone: "text-rose-900 bg-rose-50 border-rose-200",
  },
  report_writer: {
    label: "Report",
    icon: FileText,
    tone: "text-slate-800 bg-slate-50 border-slate-200",
  },
};

function kindAccent(kind: TraceEvent["kind"]): string {
  switch (kind) {
    case "protocol_deviation":
      return "border-l-rose-600 bg-rose-50/80";
    case "disagreement":
      return "border-l-amber-500 bg-amber-50/60";
    case "resolution":
      return "border-l-emerald-600 bg-emerald-50/70";
    case "error":
      return "border-l-red-600 bg-red-50/70";
    case "done":
      return "border-l-teal-700 bg-teal-50/50";
    case "tool_call":
      return "border-l-sky-500 bg-sky-50/40";
    default:
      return "border-l-teal-600/40 bg-white/70";
  }
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
      className="overflow-hidden rounded-2xl border border-teal-900/10 bg-gradient-to-b from-slate-950 to-teal-950 text-teal-50 shadow-lg shadow-teal-950/20"
      data-testid="agent-trace-panel"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <Cpu className="size-4 text-cyan-300" />
          <p className="font-[family-name:var(--font-display)] text-sm tracking-wide">
            Live agent trace
          </p>
          {running && (
            <Loader2 className="size-3.5 animate-spin text-cyan-300" aria-label="Running" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-white/10 text-[10px] text-cyan-100">
            muse-wonder-1.0
          </Badge>
          <span className="font-mono text-[10px] text-teal-200/70">{events.length} steps</span>
        </div>
      </div>

      {deviations && deviations.length > 0 && (
        <div
          className="flex items-start gap-2 border-b border-rose-400/30 bg-rose-600/30 px-4 py-3"
          data-testid="protocol-deviation-banner"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-200" />
          <div>
            <p className="text-sm font-semibold text-rose-50">
              Protocol deviation caught
              {deviations[0].factor ? ` · ${deviations[0].factor}×` : ""}
            </p>
            <p className="mt-0.5 text-xs text-rose-100/90">{deviations[0].message}</p>
          </div>
        </div>
      )}

      <ScrollArea className="h-[min(420px,50vh)]">
        <ol className="space-y-2 p-3" data-testid="agent-trace-list">
          {events.length === 0 && (
            <li className="rounded-lg border border-dashed border-white/15 px-3 py-6 text-center text-xs text-teal-200/60">
              Trace appears here as Wonder dispatches specialists…
            </li>
          )}
          {events.map((ev) => {
            const meta = ROLE_META[ev.role] ?? ROLE_META.orchestrator;
            const Icon = meta.icon;
            return (
              <li
                key={ev.id}
                className={cn(
                  "animate-in fade-in slide-in-from-bottom-1 duration-300 rounded-lg border border-white/5 border-l-4 px-3 py-2",
                  kindAccent(ev.kind),
                )}
                data-kind={ev.kind}
                data-role={ev.role}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                      meta.tone,
                    )}
                  >
                    <Icon className="size-3" />
                    {meta.label}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-teal-900/50">
                    {ev.kind.replace(/_/g, " ")}
                  </span>
                  {ev.model && (
                    <span className="ml-auto font-mono text-[10px] text-teal-900/40">
                      {ev.model}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm font-medium text-teal-950">{ev.title}</p>
                {ev.detail && (
                  <p className="mt-0.5 text-xs leading-relaxed text-teal-900/70">{ev.detail}</p>
                )}
              </li>
            );
          })}
          <div ref={endRef} />
        </ol>
      </ScrollArea>

      {!running && events.some((e) => e.kind === "done") && (
        <div className="flex items-center gap-2 border-t border-white/10 px-4 py-2 text-xs text-emerald-200">
          <CheckCircle2 className="size-3.5" />
          Orchestration complete
        </div>
      )}
    </div>
  );
}
