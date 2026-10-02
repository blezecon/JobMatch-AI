import type { Job } from "@/types";
import { fetchJson } from "../http";
import { LIMITS } from "../env";
import {
  matchesLocation,
  matchesMode,
  matchesTerms,
  queryTerms,
  stripHtml,
  type JobProvider,
  type JobQuery,
} from "../job-utils";

interface HimalayasJob {
  title?: string;
  companyName?: string;
  description?: string;
  excerpt?: string;
  employmentType?: string;
  seniority?: string;
  categories?: string[];
  locationRestrictions?: string[];
  guid?: string;
  applicationLink?: string;
}

interface HimalayasResponse {
  jobs?: HimalayasJob[];
}

/** Himalayas indexes remote-first listings and returns the full description with the list. */
const toJob = (raw: HimalayasJob): Job => ({
  id: raw.guid ?? raw.applicationLink ?? raw.title ?? "",
  title: raw.title ?? "",
  company: raw.companyName ?? "",
  location: (raw.locationRestrictions ?? []).join(", ") || "Remote",
  description: stripHtml(raw.description ?? raw.excerpt ?? ""),
  url: raw.applicationLink ?? raw.guid ?? "",
  source: "Himalayas",
  employmentType: raw.employmentType ?? "",
  remote: true,
  tags: [raw.seniority ?? "", ...(raw.categories ?? [])].filter(Boolean),
});

export const himalayas: JobProvider = {
  id: "himalayas",
  label: "Himalayas",
  homepage: "https://himalayas.app",
  requiresAttribution: true,
  // `search` is server-side and the list already carries full descriptions, so one
  // request covers the whole page. Paging deeper would need the cursor and buys
  // listings older than anyone is looking at.
  async search({ query, location, mode }: JobQuery) {
    const terms = queryTerms(query);
    const payload = await fetchJson<HimalayasResponse>(
      `https://himalayas.app/jobs/api?query=${encodeURIComponent(query)}&limit=50`,
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