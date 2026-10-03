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

interface RemoteOkJob {
  id?: string | number;
  slug?: string;
  position?: string;
  company?: string;
  description?: string;
  tags?: string[];
  location?: string;
  url?: string;
}

const toJob = (raw: RemoteOkJob): Job => ({
  id: String(raw.id ?? raw.slug ?? ""),
  title: raw.position ?? "",
  company: raw.company ?? "",
  location: raw.location || "Remote (worldwide)",
  description: stripHtml(raw.description ?? ""),
  url: raw.url ?? "",
  source: "RemoteOK",
  employmentType: "",
  remote: true,
  tags: raw.tags ?? [],
});

export const remoteok: JobProvider = {
  id: "remoteok",
  label: "RemoteOK",
  homepage: "https://remoteok.com",
  requiresAttribution: true,
  // RemoteOK has no search parameter and returns the whole ~550 KB feed, so it
  // needs a longer budget than the search-backed providers.
  async search({ query, location, mode }: JobQuery) {
    const payload = await fetchJson<(RemoteOkJob | { legal?: string })[]>(
      "https://remoteok.com/api",
      { headers: { "user-agent": "DevOrbit/1.0 (+https://github.com/blezecon/JobMatch-AI)" } },
      Math.max(LIMITS.jobTimeoutMs, 30_000),
    );
    const terms = queryTerms(query);
    return (payload as RemoteOkJob[])
      .filter((entry): entry is RemoteOkJob => typeof entry.position === "string")
      .map(toJob)
      .filter((job) => job.id && job.title)
      .filter((job) => matchesTerms(job, terms))
      .filter((job) => matchesLocation(job, location))
      .filter((job) => matchesMode(job, mode));
  },
};