import type { AiStatus } from "@/types";

/**
 * Match state is never signalled by colour alone: every status pairs a distinct
 * glyph, a word, and a border treatment.
 */
const LEVELS = {
  match: {
    glyph: "✓",
    label: "Match",
    className:
      "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100",
  },
  partial: {
    glyph: "△",
    label: "Partial",
    className:
      "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
  },
  missing: {
    glyph: "○",
    label: "Missing",
    className:
      "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  },
} as const;

export type MatchLevel = keyof typeof LEVELS;

export function LevelBadge({ level }: { level: MatchLevel }) {
  const config = LEVELS[level];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${config.className}`}
    >
      <span aria-hidden>{config.glyph}</span>
      <span className="sr-only">{config.label}: </span>
      {config.label}
    </span>
  );
}

export function AiStatusBadge({ status }: { status: AiStatus | null }) {
  if (!status) {
    return <span className="text-sm text-slate-500">Checking AI backend…</span>;
  }
  if (!status.configured) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
        <span aria-hidden>⚠</span> AI not configured — {status.error}
      </span>
    );
  }
  if (status.reachable === false) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
        title={status.error ?? undefined}
      >
        <span aria-hidden>⚠</span> {status.provider} / {status.model} unreachable
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
      <span aria-hidden>◆</span> {status.provider} / {status.model}
      {status.reachable === true ? " · ready" : ""}
    </span>
  );
}