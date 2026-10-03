import { Badge } from "@/components/ui/badge";
import { Bot, TriangleAlert } from "lucide-react";
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

export function AiStatusBadge({
  status,
  backends = [],
}: {
  status: AiStatus | null;
  /** Every backend the app supports; the active one and model are in the tooltip. */
  backends?: string[];
}) {
  if (!status) return <span className="text-sm">Checking AI backend…</span>;

  const label = backends.length > 0 ? backends.join(" / ") : status.provider;

  if (!status.configured || status.reachable === false) {
    return (
      <Badge
        variant="neutral"
        className="gap-1 border-2 border-border shadow-shadow bg-chart-3"
        title={status.error ?? undefined}
      >
        <TriangleAlert aria-hidden className="size-3" />
        {label} — not ready: {status.error ?? "backend unreachable"}
      </Badge>
    );
  }
  return (
    <Badge
      variant="neutral"
      className="gap-1 border-2 border-border shadow-shadow bg-secondary-background"
      title={`Active: ${status.provider} / ${status.model}`}
    >
      <Bot aria-hidden className="size-10" />
      {label}
      {status.reachable === true ? " · ready" : ""}
    </Badge>
  );
}
