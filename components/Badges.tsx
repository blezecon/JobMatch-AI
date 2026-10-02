import { Badge } from "@/components/ui/badge";
import { Cpu, TriangleAlert } from "lucide-react";
import type { AiStatus } from "@/types";

/**
 * Match state is never signalled by colour alone: each level pairs a distinct
 * glyph with a word, so it survives colour-blindness and greyscale printing.
 */
const LEVELS = {
  match: { glyph: "✓", label: "Match", className: "bg-chart-4" },
  partial: { glyph: "△", label: "Partial", className: "bg-chart-3" },
  missing: { glyph: "○", label: "Missing", className: "bg-secondary-background" },
} as const;

export type MatchLevel = keyof typeof LEVELS;

export function LevelBadge({ level }: { level: MatchLevel }) {
  const config = LEVELS[level];
  return (
    <Badge className={`shrink-0 gap-1 border-2 border-border shadow-shadow ${config.className}`}>
      <span aria-hidden>{config.glyph}</span>
      {config.label}
    </Badge>
  );
}

export function AiStatusBadge({ status }: { status: AiStatus | null }) {
  if (!status) return <span className="text-sm">Checking AI backend…</span>;
  if (!status.configured || status.reachable === false) {
    return (
      <Badge
        variant="neutral"
        className="gap-1 border-2 border-border shadow-shadow bg-chart-3"
        title={status.error ?? undefined}
      >
        <TriangleAlert aria-hidden className="size-3" />
        AI not ready — {status.error ?? "backend unreachable"}
      </Badge>
    );
  }
  return (
    <Badge
      variant="neutral"
      className="gap-1 border-2 border-border shadow-shadow bg-secondary-background"
    >
      <Cpu aria-hidden className="size-3" />
      {status.provider} / {status.model}
      {status.reachable === true ? " · ready" : ""}
    </Badge>
  );
}