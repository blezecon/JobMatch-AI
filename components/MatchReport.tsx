"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader,
} from "@/components/ui/card";

import { useCandidate, useJob } from "@/lib/store";
import type { MatchAnalysis } from "@/types";
import { LevelBadge } from "./Badges";
import { EmptyState, ErrorState, Heading, LoadingState } from "./Feedback";

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
  if (items.length === 0) return <p className="text-sm">Nothing in this category.</p>;
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item.requirement}
          className="flex flex-wrap items-start gap-3 rounded-base border-2 border-border p-3"
        >
          <LevelBadge level={level} />
          <div className="min-w-0 flex-1">
            <p className="font-heading font-bold">{item.requirement}</p>
            {showReason && item.reason ? <p className="mt-0.5 text-sm">{item.reason}</p> : null}
            {!showReason && item.evidence && item.evidence.length > 0 ? (
              <ul className="mt-1 space-y-0.5 text-xs opacity-80">
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
          <Link href="/resume" className={buttonVariants()}>Go to resume</Link>
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
          <Link href="/jobs" className={buttonVariants()}>Back to job search</Link>
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
  const hasRequirements =
    analysis.requirements.requiredSkills.length > 0 ||
    analysis.requirements.preferredSkills.length > 0 ||
    analysis.requirements.experienceRequirements.length > 0 ||
    analysis.requirements.educationRequirements.length > 0;
  const scored = analysis.requirements.requiredSkills.length
    ? "required skill coverage"
    : "preferred skill coverage";

  return (
    <div className="space-y-6">
      <Card className="border-4">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <Heading className="text-xl">{job.title}</Heading>
              <CardDescription>
                {job.company} · {job.location} · {job.source}
              </CardDescription>
            </div>
            <div className="text-right">
              <p className="font-heading text-4xl font-bold tabular-nums">{analysis.fitScore}%</p>
              <p className="text-xs opacity-80">{scored}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {analysis.summary ? <p className="text-sm leading-relaxed">{analysis.summary}</p> : null}
          {!hasRequirements && (
            <Alert>
              <AlertTitle>Nothing to compare</AlertTitle>
              <AlertDescription>
                The model could not pull any requirements out of this listing. Try a different job, or
                a larger model.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="pt-4">
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer noopener"
            className={buttonVariants()}
          >
            Apply on {job.source} ↗
          </a>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <Heading>Matching skills</Heading>
          <CardDescription>On your resume, and asked for by the job.</CardDescription>
        </CardHeader>
        <CardContent>
          <RequirementList items={analysis.matches} level="match" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Heading>Partial matches</Heading>
          <CardDescription>Related to the requirement, but not the same thing.</CardDescription>
        </CardHeader>
        <CardContent>
          <RequirementList items={analysis.partialMatches} level="partial" showReason />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Heading>Missing requirements</Heading>
          <CardDescription>Not evidenced anywhere in your resume.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <RequirementList
            items={analysis.missingRequirements.map((requirement) => ({ requirement }))}
            level="missing"
          />
          {analysis.missingPreferred.length > 0 ? (
            <div>
              <h3 className="mb-2 font-heading font-bold">Nice to have, also missing</h3>
              <ul className="flex flex-wrap gap-2">
                {analysis.missingPreferred.map((item) => (
                  <li key={item}>
                    <Badge variant="neutral" className="border-2 border-border">
                      <span aria-hidden className="mr-1">
                        ○
                      </span>
                      {item}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Heading>Relevant experience</Heading>
          <CardDescription>Resume items that touch the matched skills.</CardDescription>
        </CardHeader>
        <CardContent>
          {analysis.relevantExperience.length === 0 ? (
            <p className="text-sm">No experience entries matched the required skills.</p>
          ) : (
            <ul className="space-y-2">
              {analysis.relevantExperience.map((item) => (
                <li
                  key={`${item.company}-${item.title}`}
                  className="rounded-base border-2 border-border p-3"
                >
                  <p className="font-heading font-bold">
                    {item.title} · {item.company}
                  </p>
                  <p className="mt-0.5 text-sm">{item.why}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Heading>Relevant projects</Heading>
        </CardHeader>
        <CardContent>
          {analysis.relevantProjects.length === 0 ? (
            <p className="text-sm">No projects matched the required skills.</p>
          ) : (
            <ul className="space-y-2">
              {analysis.relevantProjects.map((item) => (
                <li key={item.name} className="rounded-base border-2 border-border p-3">
                  <p className="font-heading font-bold">{item.name}</p>
                  <p className="mt-0.5 text-sm">{item.why}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Heading>Resume suggestions</Heading>
          <CardDescription>
            Based only on what is already in your resume. Nothing here invents experience.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {analysis.resumeSuggestions.length === 0 ? (
            <p className="text-sm">No grounded suggestions for this role.</p>
          ) : (
            <ul className="space-y-2">
              {analysis.resumeSuggestions.map((suggestion, index) => (
                <li
                  key={`${suggestion.kind}-${index}`}
                  className="space-y-1 rounded-base border-2 border-border p-3"
                >
                  <div className="flex items-center gap-2">
                    <LevelBadge level={suggestion.kind === "missing" ? "missing" : "match"} />
                    <span className="font-heading font-bold">
                      {suggestion.kind === "missing" ? "Gap" : "Reword"}
                    </span>
                  </div>
                  <p className="text-sm">{suggestion.text}</p>
                  {suggestion.kind === "reword" && suggestion.evidenceRef ? (
                    <p className="text-xs opacity-80">
                      Based on your resume: “{suggestion.evidenceRef}”
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {analysis.meta.ungroundedSuggestionsDropped > 0 ? (
            <Alert>
              <AlertTitle>Some suggestions were discarded</AlertTitle>
              <AlertDescription>
                {analysis.meta.ungroundedSuggestionsDropped} suggestion(s) were dropped because they
                were not backed by your resume text.
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}