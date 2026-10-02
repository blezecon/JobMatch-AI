"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCandidate, useJob } from "@/lib/store";
import type { MatchAnalysis } from "@/types";
import { LevelBadge } from "./Badges";
import { EmptyState, ErrorState, LoadingState, PrimaryButton, SectionCard } from "./Feedback";

type Result = { ok: true; analysis: MatchAnalysis } | { ok: false; message: string; hint?: string };

function RequirementList({
  items,
  level,
  showReason,
}: {
  items: { requirement: string; evidence?: string[]; reason?: string }[];
  level: "match" | "partial" | "missing";
  showReason?: boolean;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">Nothing in this category.</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item.requirement}
          className="flex flex-wrap items-start gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800"
        >
          <LevelBadge level={level} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{item.requirement}</p>
            {showReason && item.reason ? (
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{item.reason}</p>
            ) : null}
            {!showReason && item.evidence && item.evidence.length > 0 ? (
              <ul className="mt-1 space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                {item.evidence.slice(0, 2).map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function MatchReport({ jobId }: { jobId: string }) {
  const candidate = useCandidate();
  const job = useJob(jobId);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!candidate || !job) return;
    let cancelled = false;
    fetch("/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ candidate, job }),
    })
      .then(async (response) => {
        const payload = (await response.json()) as MatchAnalysis | { error?: string; hint?: string };
        if (cancelled) return;
        if (!response.ok) {
          const failure = payload as { error?: string; hint?: string };
          setResult({
            ok: false,
            message: failure.error ?? "Analysis failed.",
            ...(failure.hint ? { hint: failure.hint } : {}),
          });
          return;
        }
        setResult({ ok: true, analysis: payload as MatchAnalysis });
      })
      .catch(() => {
        if (!cancelled) {
          setResult({ ok: false, message: "The analysis request could not reach the server." });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [candidate, job]);

  if (!candidate) {
    return (
      <EmptyState
        title="No resume in this session"
        message="Upload your resume first — the analysis compares it against the listing."
        action={
          <Link href="/resume">
            <PrimaryButton type="button">Go to resume</PrimaryButton>
          </Link>
        }
      />
    );
  }
  if (!job) {
    return (
      <EmptyState
        title="That job is no longer available in this session"
        message="Job text is kept only in the tab you searched from. Search again to re-analyse it."
        action={
          <Link href="/jobs">
            <PrimaryButton type="button">Back to job search</PrimaryButton>
          </Link>
        }
      />
    );
  }
  if (!result) {
    return (
      <LoadingState
        label="Comparing your resume to this job…"
        detail="Requirement extraction, deterministic matching, then a grounded explanation."
      />
    );
  }
  if (!result.ok) {
    return <ErrorState title="Analysis failed" message={result.message} hint={result.hint} />;
  }

  const { analysis } = result;
  const scored = analysis.requirements.requiredSkills.length
    ? "required skill coverage"
    : "preferred skill coverage";
  const hasRequirements =
    analysis.requirements.requiredSkills.length > 0 ||
    analysis.requirements.preferredSkills.length > 0 ||
    analysis.requirements.experienceRequirements.length > 0 ||
    analysis.requirements.educationRequirements.length > 0;
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{job.title}</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {job.company} · {job.location} · {job.source}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tabular-nums">{analysis.fitScore}%</p>
            <p className="text-xs text-slate-500">{scored}</p>
          </div>
        </div>
        {analysis.summary ? (
          <p className="mt-4 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {analysis.summary}
          </p>
        ) : null}
        {!hasRequirements && (
          <p className="mt-4 text-sm text-amber-800 dark:text-amber-200">
            <span aria-hidden>⚠</span> The model could not pull any requirements out of this
            listing, so there is nothing to compare. Try a different job, or a larger model.
          </p>
        )}
        <a
          href={job.url}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-4 inline-flex items-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          Apply on {job.source} ↗
        </a>
      </section>

      <SectionCard title="Matching skills" description="On your resume, and asked for by the job.">
        <RequirementList items={analysis.matches} level="match" />
      </SectionCard>

      <SectionCard
        title="Partial matches"
        description="Related to the requirement, but not the same thing."
      >
        <RequirementList items={analysis.partialMatches} level="partial" showReason />
      </SectionCard>

      <SectionCard title="Missing requirements" description="Not evidenced anywhere in your resume.">
        <RequirementList
          items={analysis.missingRequirements.map((requirement) => ({ requirement }))}
          level="missing"
        />
        {analysis.missingPreferred.length > 0 ? (
          <div className="mt-5">
            <h3 className="mb-2 text-sm font-medium">Nice to have, also missing</h3>
            <ul className="flex flex-wrap gap-1.5">
              {analysis.missingPreferred.map((item) => (
                <li
                  key={item}
                  className="rounded-full border border-slate-300 px-2.5 py-1 text-xs dark:border-slate-700"
                >
                  <span aria-hidden className="mr-1">
                    ○
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Relevant experience" description="Resume items that touch the matched skills.">
        {analysis.relevantExperience.length === 0 ? (
          <p className="text-sm text-slate-500">No experience entries matched the required skills.</p>
        ) : (
          <ul className="space-y-2">
            {analysis.relevantExperience.map((item) => (
              <li
                key={`${item.company}-${item.title}`}
                className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
              >
                <p className="text-sm font-medium">
                  {item.title} · {item.company}
                </p>
                <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{item.why}</p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Relevant projects">
        {analysis.relevantProjects.length === 0 ? (
          <p className="text-sm text-slate-500">No projects matched the required skills.</p>
        ) : (
          <ul className="space-y-2">
            {analysis.relevantProjects.map((item) => (
              <li key={item.name} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <p className="text-sm font-medium">{item.name}</p>
                <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{item.why}</p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Resume suggestions"
        description="Based only on what is already in your resume. Nothing here invents experience."
      >
        {analysis.resumeSuggestions.length === 0 ? (
          <p className="text-sm text-slate-500">No grounded suggestions for this role.</p>
        ) : (
          <ul className="space-y-2">
            {analysis.resumeSuggestions.map((suggestion, index) => (
              <li
                key={`${suggestion.kind}-${index}`}
                className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
              >
                <div className="mb-1 flex items-center gap-2">
                  <LevelBadge level={suggestion.kind === "missing" ? "missing" : "match"} />
                  {suggestion.kind === "missing" ? "Gap" : "Reword"}
                </div>
                <p className="text-sm">{suggestion.text}</p>
                {suggestion.kind === "reword" && suggestion.evidenceRef ? (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Based on your resume: “{suggestion.evidenceRef}”
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {analysis.meta.ungroundedSuggestionsDropped > 0 ? (
          <p className="mt-3 text-xs text-slate-500">
            {analysis.meta.ungroundedSuggestionsDropped} suggestion(s) were discarded because they
            were not backed by your resume text.
          </p>
        ) : null}
      </SectionCard>
    </div>
  );
}