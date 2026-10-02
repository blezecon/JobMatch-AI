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

interface JobicyJob {
  id?: number | string;
  url?: string;
  jobTitle?: string;
  companyName?: string;
  jobDescription?: string;
  jobGeo?: string;
  jobIndustry?: string[];
  jobType?: string[];
  jobLevel?: string;
}

const toJob = (raw: JobicyJob): Job => ({
  id: String(raw.id ?? ""),
  title: raw.jobTitle ?? "",
  company: raw.companyName ?? "",
  location: raw.jobGeo || "Remote",
  description: stripHtml(raw.jobDescription ?? ""),
  url: raw.url ?? "",
  source: "Jobicy",
  employmentType: (raw.jobType ?? []).join(", "),
  remote: true,
  tags: [raw.jobLevel ?? "", ...(raw.jobIndustry ?? [])].filter(Boolean),
});

export const jobicy: JobProvider = {
  id: "jobicy",
  label: "Jobicy",
  homepage: "https://jobicy.com",
  requiresAttribution: true,
  async search({ query, location, mode }: JobQuery) {
    const terms = queryTerms(query);
    // Jobicy accepts one free-form tag; use it when the query is a single word.
    const tag = terms.length === 1 && /^[a-z0-9+#.]+$/.test(terms[0]) ? terms[0] : "";
    const params = new URLSearchParams({ count: "100" });
    if (tag) params.set("tag", tag);
    const payload = await fetchJson<{ jobs?: JobicyJob[] }>(
      `https://jobicy.com/api/v2/remote-jobs?${params.toString()}`,
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