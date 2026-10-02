"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { saveJobs } from "@/lib/store";
import type { Job, JobsResponse } from "@/types";
import { EmptyState, ErrorState, LoadingState, PrimaryButton } from "./Feedback";

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
      <form
        onSubmit={runSearch}
        className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="sm:col-span-2">
          <label htmlFor="role" className="mb-1 block text-sm font-medium">
            Role or keywords
          </label>
          <input
            id="role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            placeholder="Frontend Developer"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus-visible:border-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/20 dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
        <div>
          <label htmlFor="location" className="mb-1 block text-sm font-medium">
            Location
          </label>
          <input
            id="location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Kolkata, India"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus-visible:border-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/20 dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
        <div>
          <label htmlFor="mode" className="mb-1 block text-sm font-medium">
            Work mode
          </label>
          <select
            id="mode"
            value={mode}
            onChange={(event) => setMode(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus-visible:border-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/20 dark:border-slate-700 dark:bg-slate-950"
          >
            {MODES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <PrimaryButton type="submit" disabled={state.status === "loading"}>
            {state.status === "loading" ? "Searching…" : "Search jobs"}
          </PrimaryButton>
        </div>
      </form>

      {state.status === "loading" ? (
        <LoadingState label="Searching job boards…" detail="Querying free public job APIs." />
      ) : null}

      {state.status === "error" ? (
        <ErrorState title="Search failed" message={state.message} hint={state.hint} />
      ) : null}

      {state.status === "done" && state.jobs.length === 0 ? (
        <EmptyState
          title="No jobs found"
          message="Try a broader role, drop the location filter, or set the work mode to Any."
          action={
            <PrimaryButton
              type="button"
              onClick={() => {
                setLocation("");
                setMode("any");
              }}
            >
              Clear filters
            </PrimaryButton>
          }
        />
      ) : null}

      {state.status === "done" && state.jobs.length > 0 ? (
        <div className="space-y-3">
          {state.warnings.length > 0 ? (
            <p role="status" className="text-xs text-amber-700 dark:text-amber-300">
              Some sources were unavailable: {state.warnings.join(" ")}
            </p>
          ) : null}
          <ul className="space-y-3">
            {state.jobs.map((job) => (
              <li key={`${job.source}-${job.id}`}>
                <article className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold tracking-tight">{job.title}</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        {job.company} · {job.location}
                        {job.employmentType ? ` · ${job.employmentType}` : ""}
                      </p>
                    </div>
                    <span className="rounded-full border border-slate-300 px-2 py-0.5 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                      {job.source}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm text-slate-600 dark:text-slate-300">
                    {job.description.slice(0, 320)}
                    {job.description.length > 320 ? "…" : ""}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <PrimaryButton
                      type="button"
                      onClick={() => router.push(`/analyze/${encodeURIComponent(job.id)}`)}
                    >
                      Analyze match
                    </PrimaryButton>
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      Apply on {job.source} ↗
                    </a>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}