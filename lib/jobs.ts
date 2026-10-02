import type { Job } from "@/types";
import { ApiError } from "./http";
import { dedupeKey, type JobProvider, type JobQuery } from "./job-utils";
import { arbeitnow } from "./providers/arbeitnow";
import { jobicy } from "./providers/jobicy";
import { remoteok } from "./providers/remoteok";
import { remotive } from "./providers/remotive";

export type { JobProvider, JobQuery, WorkModeFilter } from "./job-utils";

/**
 * Every provider is free and key-less, so a clean `npm install` can search real
 * jobs. One provider being down must not blank the page: results are merged and
 * the failure is reported as a warning.
 */
export const PROVIDERS: JobProvider[] = [arbeitnow, jobicy, remoteok, remotive];

export type JobSearchResult = {
  jobs: Job[];
  warnings: string[];
};

export async function searchJobs(query: JobQuery): Promise<JobSearchResult> {
  const results = await Promise.allSettled(
    PROVIDERS.map(async (provider) => ({
      provider,
      jobs: await provider.search(query),
    })),
  );

  const warnings: string[] = [];
  const seen = new Set<string>();
  const jobs: Job[] = [];

  for (const result of results) {
    if (result.status === "rejected") {
      const reason = result.reason instanceof Error ? result.reason.message : "unknown error";
      warnings.push(reason);
      continue;
    }
    for (const job of result.value.jobs) {
      const key = dedupeKey(job);
      if (seen.has(key)) continue;
      seen.add(key);
      // Namespace the id by source: feeds number their jobs independently.
      jobs.push({ ...job, id: `${result.value.provider.id}-${job.id}` });
      if (jobs.length >= 60) break;
    }
  }

  if (!results.some((result) => result.status === "fulfilled")) {
    throw new ApiError(
      "No job service could be reached.",
      502,
      `${warnings[0] ?? "All providers failed."} Check your internet connection and try again.`,
    );
  }

  return { jobs, warnings };
}