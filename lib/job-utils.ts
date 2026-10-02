import type { Job, WorkMode } from "@/types";

/** Shared plumbing for job providers: one shape in, normalized `Job` objects out. */

export type WorkModeFilter = WorkMode | "any";

export type JobQuery = {
  query: string;
  location?: string;
  mode?: WorkModeFilter;
};

export type JobProvider = {
  id: string;
  label: string;
  homepage: string;
  /** Provider terms usually require a visible link back — the UI renders this on every card. */
  requiresAttribution: boolean;
  search: (query: JobQuery) => Promise<Job[]>;
};

/** Job feeds ship HTML; the model only needs plain text. */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export function queryTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 1);
}

/** Every term must appear somewhere in the listing. Predictable, and easy to explain. */
export function matchesTerms(job: Job, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const haystack = [job.title, job.company, job.tags.join(" "), job.description.slice(0, 4000)]
    .join(" ")
    .toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

export function matchesLocation(job: Job, location?: string): boolean {
  if (!location) return true;
  return job.location.toLowerCase().includes(location.toLowerCase());
}

export function matchesMode(job: Job, mode: WorkModeFilter = "any"): boolean {
  const haystack = `${job.location} ${job.tags.join(" ")}`.toLowerCase();
  switch (mode) {
    case "remote":
      return job.remote || haystack.includes("remote");
    case "hybrid":
      return haystack.includes("hybrid");
    case "onsite":
      return !job.remote && !haystack.includes("remote");
    default:
      return true;
  }
}

export function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Same job on two feeds: same title and company. */
export function dedupeKey(job: Job): string {
  return `${slug(job.title)}::${slug(job.company)}`;
}