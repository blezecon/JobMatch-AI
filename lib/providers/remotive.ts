import type { Job } from "@/types";
import { LIMITS } from "../env";
import { fetchJson } from "../http";
import {
  matchesLocation,
  matchesMode,
  matchesTerms,
  queryTerms,
  stripHtml,
  type JobProvider,
  type JobQuery,
} from "../job-utils";

interface RemotiveJob {
  id?: number | string;
  url?: string;
  title?: string;
  company_name?: string;
  description?: string;
  candidate_required_location?: string;
  job_type?: string;
  category?: string;
  tags?: string[];
}

const toJob = (raw: RemotiveJob): Job => ({
  id: String(raw.id ?? ""),
  title: raw.title ?? "",
  company: raw.company_name ?? "",
  location: raw.candidate_required_location || "Remote",
  description: stripHtml(raw.description ?? ""),
  url: raw.url ?? "",
  source: "Remotive",
  employmentType: raw.job_type ?? "",
  remote: true,
  tags: [raw.category ?? "", ...(raw.tags ?? [])].filter(Boolean),
});

export const remotive: JobProvider = {
  id: "remotive",
  label: "Remotive",
  homepage: "https://remotive.com",
  requiresAttribution: true,
  async search({ query, location, mode }: JobQuery) {
    const terms = queryTerms(query);
    const params = new URLSearchParams({ limit: "50" });
    // Remotive does support free-text search server-side.
    if (terms.length) params.set("search", terms.join(" "));
    const payload = await fetchJson<{ jobs?: RemotiveJob[] }>(
      `https://remotive.com/api/remote-jobs?${params.toString()}`,
      {},
      LIMITS.jobTimeoutMs,
    );
    return (payload.jobs ?? [])
      .map(toJob)
      .filter((job) => job.id && job.title)
      .filter((job) => matchesTerms(job, terms))
      .filter((job) => matchesLocation(job, location))
      .filter((job) => matchesMode(job, mode));
  },
};