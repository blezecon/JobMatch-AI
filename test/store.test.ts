import { beforeEach, expect, it, vi } from "vitest";
import type { Candidate, Job } from "@/types";

/**
 * Regression: useSyncExternalStore compares snapshots by identity. Rebuilding the
 * snapshot object on every call caused an infinite render loop and
 * "Maximum update depth exceeded" on the resume page.
 */

const store: { sessionStorage: Storage } = {} as never;

function loadStore() {
  vi.resetModules();
  // A minimal sessionStorage; each entry is a distinct object, as the real one
  // would be after JSON.parse.
  const data = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => void data.delete(key),
    setItem: (key: string, value: string) => void data.set(key, value),
  };
  Object.defineProperty(globalThis, "window", {
    value: { sessionStorage: storage },
    writable: true,
    configurable: true,
  });
  return import("@/lib/store");
}

const candidate: Candidate = {
  name: "Ada",
  summary: "",
  skills: ["React"],
  education: [],
  experience: [],
  projects: [],
  certifications: [],
};

beforeEach(() => {
  Object.defineProperty(globalThis, "window", {
    value: { sessionStorage: store.sessionStorage },
    writable: true,
    configurable: true,
  });
});

it("returns the identical object on repeated reads", async () => {
  const { saveCandidate, getCandidate } = await loadStore();
  saveCandidate(candidate);
  const first = getCandidate();
  expect(getCandidate()).toBe(first);
  expect(getCandidate()).toBe(first);
});

it("returns a new object only after a write", async () => {
  const { saveCandidate, getCandidate } = await loadStore();
  saveCandidate(candidate);
  const before = getCandidate();
  saveCandidate({ ...candidate, name: "Grace" });
  expect(getCandidate()).not.toBe(before);
  expect(getCandidate()?.name).toBe("Grace");
});

it("does not re-parse storage on every call", async () => {
  const { saveCandidate, getCandidate } = await loadStore();
  saveCandidate(candidate);
  const before = getCandidate();
  let calls = 0;
  const original = globalThis.window.sessionStorage.getItem;
  globalThis.window.sessionStorage.getItem = ((...args: Parameters<typeof original>) => {
    calls += 1;
    return original.apply(globalThis.window.sessionStorage, args);
  }) as typeof original;
  getCandidate();
  getCandidate();
  globalThis.window.sessionStorage.getItem = original;
  expect(calls).toBe(0);
  expect(before).toBeTruthy();
});

it("keeps the same job object identity so effects do not re-fire", async () => {
  const { saveJobs, getJob } = await loadStore();
  const job = (id: string, title: string): Job => ({
    id,
    title,
    company: "Acme",
    location: "Remote",
    description: "",
    url: `https://example.com/${id}`,
    source: "Test",
    employmentType: "",
    remote: true,
    tags: [],
  });
  saveJobs([job("a", "Dev"), job("b", "Lead")]);
  expect(getJob("b")).toBe(getJob("b"));
  expect(getJob("missing")).toBeNull();
});

it("survives corrupt storage instead of throwing", async () => {
  const { getCandidate, getJob } = await loadStore();
  globalThis.window.sessionStorage.setItem("jobmatch:candidate", "{not json");
  expect(getCandidate()).toBeNull();
  expect(getJob("a")).toBeNull();
});