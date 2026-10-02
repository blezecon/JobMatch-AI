"use client";

import { useSyncExternalStore } from "react";
import type { Candidate, Job } from "@/types";

/**
 * No database and no server session: the resume lives in this tab only and
 * disappears when the tab closes. Nothing is written to disk.
 *
 * Read through useSyncExternalStore because sessionStorage is browser-only.
 * The snapshot MUST be the same object until something actually changes —
 * useSyncExternalStore compares by identity, and a fresh object each call
 * re-renders forever.
 */
const CANDIDATE_KEY = "jobmatch:candidate";
const JOBS_KEY = "jobmatch:jobs";

type Snapshot = { candidate: Candidate | null; jobs: Job[] };

const EMPTY: Snapshot = { candidate: null, jobs: [] };
let cache: Snapshot | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Parses sessionStorage at most once, then hands back the identical object. */
function readSnapshot(): Snapshot {
  if (cache) return cache;
  try {
    const candidate = window.sessionStorage.getItem(CANDIDATE_KEY);
    const jobs = window.sessionStorage.getItem(JOBS_KEY);
    cache = {
      candidate: candidate ? (JSON.parse(candidate) as Candidate) : null,
      jobs: jobs ? (JSON.parse(jobs) as Job[]) : [],
    };
  } catch {
    // Corrupt or unavailable storage behaves like an empty session.
    cache = EMPTY;
  }
  return cache;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab writing the same key must invalidate this tab's cache.
  const onStorage = () => {
    cache = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function write(key: string, value: unknown) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or quota exceeded: the page still works, it just forgets.
  }
  cache = null;
  emit();
}

export function saveCandidate(candidate: Candidate) {
  write(CANDIDATE_KEY, candidate);
}

export function getCandidate(): Candidate | null {
  return readSnapshot().candidate;
}

export function saveJobs(jobs: Job[]) {
  write(JOBS_KEY, jobs);
}

/** The analysis page needs the listing text again; a job id alone is not enough. */
export function getJob(jobId: string): Job | null {
  return readSnapshot().jobs.find((job) => job.id === jobId) ?? null;
}

// Server render and first client render must agree, so the server snapshot is
// the empty one; the client snapshot fills in on the first commit.
const serverSnapshot = (): Snapshot => EMPTY;

const subscribeToStore = subscribe;
const readStore = readSnapshot;

export function useCandidate(): Candidate | null {
  return useSyncExternalStore(
    subscribeToStore,
    () => readStore().candidate,
    () => null,
  );
}

export function useJob(jobId: string): Job | null {
  return useSyncExternalStore(
    subscribeToStore,
    () => getJob(jobId),
    () => null,
  );
}

export function useStoreSnapshot(): Snapshot {
  return useSyncExternalStore(subscribeToStore, readStore, serverSnapshot);
}