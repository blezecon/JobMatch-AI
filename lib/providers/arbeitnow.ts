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

interface ArbeitnowJob {
  slug?: string;
  title?: string;
  company_name?: string;
  description?: string;
  remote?: string | boolean;
  url?: string;
  tags?: string[];
  job_types?: string[];
  location?: string;
}

const toJob = (raw: ArbeitnowJob): Job => ({
  id: raw.slug ?? "",
  title: raw.title ?? "",
  company: raw.company_name ?? "",
  location: raw.location || "Not specified",
  description: stripHtml(raw.description ?? ""),
  // The feed's own `url` is the company homepage; the listing lives on arbeitnow.com.
  url: raw.slug ? `https://www.arbeitnow.com/view/${raw.slug}` : (raw.url ?? ""),
  source: "Arbeitnow",
  employmentType: (raw.job_types ?? []).join(", "),
  remote: String(raw.remote).toLowerCase() === "true" || (raw.tags ?? []).some((t) => /remote/i.test(t)),
  tags: raw.tags ?? [],
});

export const arbeitnow: JobProvider = {
  id: "arbeitnow",
  label: "Arbeitnow",
  homepage: "https://www.arbeitnow.com",
  requiresAttribution: true,
  async search({ query, location, mode }: JobQuery) {
    const terms = queryTerms(query);
    // No search parameter, so filtering is client-side — which means the newest
    // page alone hides almost everything. Two pages is the ceiling before this
    // starts abusing a free API; their terms ask for a link back, which we give.
    const pages = await Promise.all(
      [1, 2].map((page) =>
        fetchJson<{ data?: ArbeitnowJob[] }>(
          `https://www.arbeitnow.com/api/job-board-api?page=${page}`,
          {},
          LIMITS.jobTimeoutMs,
        ).catch(() => ({ data: [] })),
      ),
    );
    return pages
      .flatMap((payload) => payload.data ?? [])
      .map(toJob)
      .filter((job) => job.id && job.title)
      .filter((job) => matchesTerms(job, terms))
      .filter((job) => matchesLocation(job, location))
      .filter((job) => matchesMode(job, mode));
  },
};