"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Heading } from "@/components/Feedback";
import { saveJobs } from "@/lib/store";
import { Search, Loader2, TriangleAlert, Sparkles, ExternalLink, ScanSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Job, JobsResponse } from "@/types";

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; jobs: Job[]; warnings: string[] }
  | { status: "error"; message: string; hint?: string };

const MODES = [
  { value: "any", label: "Any" },
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
] as const;

export function JobSearch() {
  const router = useRouter();
  const params = useSearchParams();
  const [role, setRole] = useState(params.get("role") ?? "Frontend Developer");
  const [location, setLocation] = useState(params.get("location") ?? "");
  const [mode, setMode] = useState(params.get("mode") ?? "any");
  const [state, setState] = useState<SearchState>({ status: "idle" });

  const runSearch = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const query = role.trim();
      if (query.length < 2) {
        setState({ status: "error", message: "Enter a role or a few keywords." });
        return;
      }
      setState({ status: "loading" });
      const search = new URLSearchParams({ role: query, mode });
      if (location.trim()) search.set("location", location.trim());

      try {
        const response = await fetch(`/api/jobs?${search.toString()}`);
        const payload = (await response.json()) as JobsResponse | { error?: string; hint?: string };
        if (!response.ok) {
          const failure = payload as { error?: string; hint?: string };
          setState({
            status: "error",
            message: failure.error ?? "Job search failed.",
            ...(failure.hint ? { hint: failure.hint } : {}),
          });
          return;
        }
        const { jobs, warnings } = payload as JobsResponse;
        saveJobs(jobs);
        setState({ status: "done", jobs, warnings });
      } catch {
        setState({
          status: "error",
          message: "The job search could not reach the server.",
          hint: "Check your connection and try again.",
        });
      }
    },
    [role, location, mode],
  );

  return (
    <div className="space-y-6">
      <Card>
        <form onSubmit={runSearch}>
          <CardHeader>
            <Heading className="flex items-center gap-2">
              <Search aria-hidden className="size-5" />
              Search openings
            </Heading>
            <CardDescription>
              Six free public job APIs, queried at once. Applying always happens on the original
              listing.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="role">Role or keywords</FieldLabel>
              <Input
                id="role"
                value={role}
                onChange={(event) => setRole(event.target.value)}
                placeholder="Frontend Developer"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="location">Location</FieldLabel>
              <Input
                id="location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Kolkata, India"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="mode">Work mode</FieldLabel>
              <NativeSelect id="mode" value={mode} onChange={(event) => setMode(event.target.value)}>
                {MODES.map((option) => (
                  <NativeSelectOption key={option.value} value={option.value}>
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </CardContent>
          {/* Breathing room so the hover translate does not touch the location field. */}
          <CardFooter className="pt-4">
            <Button type="submit" className="w-full sm:w-auto" disabled={state.status === "loading"}>
              {state.status === "loading" ? (
                <>
                  <Loader2 aria-hidden className="animate-spin" />
                  Searching…
                </>
              ) : (
                <>
                  <Search aria-hidden />
                  Search jobs
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {state.status === "error" ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle className="flex items-center gap-2">
            <TriangleAlert aria-hidden className="size-4" />
            Search failed
          </AlertTitle>
          <AlertDescription>
            <p>{state.message}</p>
            {state.hint ? <p className="opacity-80">{state.hint}</p> : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {state.status === "done" && state.warnings.length > 0 ? (
        <Alert>
          <AlertTitle className="flex items-center gap-2">
            <TriangleAlert aria-hidden className="size-4" />
            Some sources were unavailable
          </AlertTitle>
          <AlertDescription>{state.warnings.join(" ")}</AlertDescription>
        </Alert>
      ) : null}

      {state.status === "done" && state.jobs.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle className="flex items-center gap-2">
              <Sparkles aria-hidden className="size-4" />
              No jobs found
            </EmptyTitle>
            <EmptyDescription>
              Try a broader role, drop the location filter, or set the work mode to Any.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {state.status === "done" && state.jobs.length > 0 ? (
        <ul className="space-y-3">
          {state.jobs.map((job) => (
            <li key={job.id}>
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <Heading>{job.title}</Heading>
                      <CardDescription>
                        {job.company} · {job.location}
                        {job.employmentType ? ` · ${job.employmentType}` : ""}
                      </CardDescription>
                    </div>
                    <Badge variant="neutral" className="border-2 border-border">
                      {job.source}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-3 text-sm">
                    {job.description.slice(0, 320)}
                    {job.description.length > 320 ? "…" : ""}
                  </p>
                </CardContent>
                <CardFooter className="flex-wrap gap-x-3 gap-y-4 pt-4">
                  <Button
                    className="w-full sm:w-auto"
                    onClick={() => router.push(`/analyze/${encodeURIComponent(job.id)}`)}
                  >
                    <ScanSearch aria-hidden />
                    Analyze match
                  </Button>
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={cn(buttonVariants({ variant: "neutral" }), "w-full sm:w-auto")}
                  >
                    <ExternalLink aria-hidden />
                    Apply on {job.source}
                  </a>
                </CardFooter>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}