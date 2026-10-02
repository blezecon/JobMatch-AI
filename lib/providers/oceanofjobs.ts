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

interface OojJob {
  id?: string;
  title?: string;
  company_name?: string;
  location?: string;
  description?: string;
  url?: string;
  workplace_type?: string | null;
  ats?: string;
  seniority?: string | null;
  category?: string;
  skills?: string;
  employmentType?: string;
}

interface OojList {
  jobs?: OojJob[];
}

const BASE = "https://oceanofjobs.com/api";

// This feed has no language facet, so a plain "frontend" search turns up
// Ukrainian and Russian listings that the model then reports requirements from.
// ponytail: a Cyrillic check clears the bulk of them; CJK, Arabic and Devanagari
// listings still slip through. Upgrade path is a per-listing language check, which
// costs a model call per result and is not worth it yet.
const NON_LATIN = /\p{Script=Cyrillic}/u;

const readable = (job: Job) =>
  !NON_LATIN.test(job.title) && !NON_LATIN.test(job.description.slice(0, 600));

/**
 * The list endpoint omits descriptions, and requirement extraction needs one.
 * ponytail: DESCRIPTION_FETCHES detail calls per search, capped so we do not
 * hammer the API. Raise it only alongside a cache, which this app deliberately
 * does not have.
 */
const DESCRIPTION_FETCHES = 12;

const toJob = (raw: OojJob): Job => ({
  id: raw.id ?? "",
  title: (raw.title ?? "").trim(),
  company: raw.company_name ?? "",
  location: raw.location || "Remote",
  description: "",
  url: raw.url ?? "",
  source: "Ocean of Jobs",
  employmentType: raw.employmentType ?? "",
  remote: (raw.workplace_type ?? "").toLowerCase() === "remote",
  tags: [
    raw.seniority ?? "",
    raw.category ?? "",
    ...(raw.skills ? raw.skills.split(",") : []),
  ]
    .map((tag) => tag.trim())
    .filter(Boolean),
});

export const oceanofjobs: JobProvider = {
  id: "oceanofjobs",
  label: "Ocean of Jobs",
  homepage: "https://oceanofjobs.com",
  requiresAttribution: true,
  // `include_outdated=1` is the whole point: it surfaces postings older than a
  // year, which the API hides by default. `workplace` gives us a real structured
  // remote/hybrid/onsite flag instead of guessing from the location string.
  async search({ query, location, mode }: JobQuery) {
    const terms = queryTerms(query);
    const params = new URLSearchParams({
      search: query,
      limit: "50",
      include_outdated: "1",
      confidence: "all",
    });
    if (mode && mode !== "any") params.set("workplace", mode);

    const payload = await fetchJson<OojList>(`${BASE}/jobs?${params.toString()}`, {}, LIMITS.jobTimeoutMs);

    const listed = (payload.jobs ?? []).map(toJob).filter((job) => job.id && job.title);
    // Filter on the title before spending detail calls on it; the description
    // can still be in another language, so it is re-checked afterwards.
    const kept = listed
      .filter((job) => !NON_LATIN.test(job.title))
      .filter((job) => matchesTerms(job, terms))
      .filter((job) => matchesLocation(job, location))
      .filter((job) => matchesMode(job, mode));

    const detailed = await Promise.all(
      kept.slice(0, DESCRIPTION_FETCHES).map(async (job) => {
        try {
          const detail = await fetchJson<OojJob | { job: OojJob }>(
            `${BASE}/jobs/${job.id}`,
            {},
            LIMITS.jobTimeoutMs,
          );
          const full = ("job" in detail ? detail.job : detail) as OojJob;
          return { ...job, description: stripHtml(full.description ?? "") };
        } catch {
          // A missing description means this listing cannot be analysed; the UI
          // says so rather than inventing one.
          return job;
        }
      }),
    );

    // Listings past the detail budget, or in a script we cannot read, are dropped
    // rather than shown unanalysable.
    return detailed.filter(readable);
  },
};