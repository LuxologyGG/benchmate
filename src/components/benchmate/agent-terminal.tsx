"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { AgentResult } from "@/lib/types";

type Line = {
  ts: string;
  role: "system" | "tool" | "result" | "plan";
  text: string;
};

function stamp(offsetSec: number): string {
  const d = new Date(0, 0, 0, 0, 0, offsetSec);
  return d.toTimeString().slice(0, 8);
}

function buildLines(agent: AgentResult): Line[] {
  const lines: Line[] = [
    { ts: stamp(0), role: "system", text: "wonder.dispatch — tool-using agent online" },
    { ts: stamp(1), role: "plan", text: agent.plan },
  ];
  let t = 2;
  for (const step of agent.steps) {
    if (step.type === "tool_call") {
      lines.push({
        ts: stamp(t++),
        role: "tool",
        text: `${step.toolName ?? "tool"}(${JSON.stringify(step.toolInput ?? {}).slice(0, 100)})`,
      });
      if (step.toolOutput != null) {
        lines.push({
          ts: stamp(t++),
          role: "result",
          text: JSON.stringify(step.toolOutput).slice(0, 120),
        });
      }
    } else if (step.content) {
      lines.push({
        ts: stamp(t++),
        role: "system",
        text: step.content.slice(0, 140),
      });
    }
  }
  for (const c of agent.computed) {
    lines.push({
      ts: stamp(t++),
      role: "result",
      text: `${c.label} = ${Number(c.value).toPrecision(c.significantFigures)} ${c.unit}  ← ${c.citation.toolName}`,
    });
  }
  return lines;
}

const roleClass: Record<Line["role"], string> = {
  system: "text-muted-foreground",
  plan: "text-foreground/70",
  tool: "text-accent",
  result: "text-foreground/90",
};

const rolePrefix: Record<Line["role"], string> = {
  system: "::",
  plan: "##",
  tool: "→",
  result: "←",
};

export function AgentTerminal({
  agent,
  className,
  streaming = true,
}: {
  agent: AgentResult;
  className?: string;
  streaming?: boolean;
}) {
  const lines = useMemo(() => buildLines(agent), [agent]);
  const [visible, setVisible] = useState(streaming ? 0 : lines.length);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!streaming) {
      setVisible(lines.length);
      return;
    }
    setVisible(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setVisible(i);
      if (i >= lines.length) window.clearInterval(id);
    }, 90);
    return () => window.clearInterval(id);
  }, [lines, streaming]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [visible]);

  return (
    <div
      className={cn(
        "relative overflow-hidden border border-border/70 bg-[#070708]",
        className,
      )}
      data-testid="agent-terminal"
      data-slot="agent-terminal"
    >
      <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
          agent_trace
        </span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          wonder · live
        </span>
      </div>
      <div
        ref={scroller}
        className="max-h-64 space-y-0.5 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed sm:text-xs"
      >
        {lines.slice(0, visible).map((line, i) => (
          <div
            key={`${line.ts}-${i}`}
            className={cn("flex gap-2 animate-in fade-in slide-in-from-left-1 duration-300", roleClass[line.role])}
          >
            <span className="shrink-0 text-muted-foreground/70 tabular-nums">{line.ts}</span>
            <span className="shrink-0 opacity-50">{rolePrefix[line.role]}</span>
            <span className="min-w-0 break-all">{line.text}</span>
          </div>
        ))}
        {visible < lines.length && (
          <span className="inline-block h-3 w-[2px] animate-pulse bg-accent" />
        )}
        {visible >= lines.length && (
          <div className="flex items-center gap-2 text-accent">
            <span className="opacity-50">&gt;</span>
            <span className="animate-pulse">▌</span>
          </div>
        )}
      </div>
    </div>
  );
}
