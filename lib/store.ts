"use client";

import { useSyncExternalStore } from "react";
import type { Candidate, Job } from "@/types";

/**
 * No database and no server session: the resume lives in this tab only and
 * disappears when the tab closes. Nothing is written to disk.
 *
 * Exposed through `useSyncExternalStore` because reading sessionStorage during
 * render would break hydration, and reading it in an effect would just be a
 * slower, flakier version of the same thing.
 */
const CANDIDATE_KEY = "jobmatch:candidate";
const JOBS_KEY = "jobmatch:jobs";

// A cached snapshot keeps the object identity stable, which React requires of
// useSyncExternalStore; sessionStorage alone would re-parse on every read.
let snapshot: { candidate: Candidate | null; jobs: Job[] } = { candidate: null, jobs: [] };
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function readSnapshot() {
  if (typeof window === "undefined") return { candidate: null, jobs: [] };
  try {
    const candidate = window.sessionStorage.getItem(CANDIDATE_KEY);
    const jobs = window.sessionStorage.getItem(JOBS_KEY);
    snapshot = {
      candidate: candidate ? (JSON.parse(candidate) as Candidate) : null,
      jobs: jobs ? (JSON.parse(jobs) as Job[]) : [],
    };
  } catch {
    snapshot = { candidate: null, jobs: [] };
  }
  return snapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab writing the same key should update this one.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function write(key: string, value: unknown) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or quota exceeded: the page still works, it just forgets.
  }
  emit();
}

export function saveCandidate(candidate: Candidate) {
  write(CANDIDATE_KEY, candidate);
}

export function getCandidate() {
  return readSnapshot().candidate;
}

export function saveJobs(jobs: Job[]) {
  write(JOBS_KEY, jobs);
}

/** The analysis page needs the listing text again; a job id alone is not enough. */
export function getJob(jobId: string): Job | null {
  return readSnapshot().jobs.find((job) => job.id === jobId) ?? null;
}

export function useCandidate(): Candidate | null {
  return useSyncExternalStore(subscribe, getCandidate, () => null);
}

export function useJob(jobId: string): Job | null {
  return useSyncExternalStore(subscribe, () => getJob(jobId), () => null);
}