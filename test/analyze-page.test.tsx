import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Candidate, Job } from "@/types";

/**
 * The /analyze page is client-only: the server ships a loading shell and the
 * report appears once sessionStorage resolves and POST /api/analyze answers.
 * This mounts the real page component over a stubbed fetch, so a regression in
 * the section wiring fails here rather than in someone's browser.
 */

const candidate: Candidate = {
  name: "Priya Sharma",
  summary: "",
  skills: ["React", "JavaScript"],
  education: [],
  experience: [],
  projects: [],
  certifications: [],
};

const job: Job = {
  id: "test-1",
  title: "Frontend Developer",
  company: "Acme",
  location: "Remote",
  description: "React and TypeScript",
  url: "https://example.com/job",
  source: "Test",
  employmentType: "Full-time",
  remote: true,
  tags: [],
};

const analysis = {
  job,
  requirements: {
    title: job.title,
    company: job.company,
    location: job.location,
    experienceRequirements: [],
    requiredSkills: ["React", "TypeScript"],
    preferredSkills: [],
    educationRequirements: [],
    responsibilities: [],
  },
  fitScore: 50,
  matches: [{ requirement: "React", evidence: ["React"] }],
  partialMatches: [{ requirement: "Tailwind CSS", evidence: ["CSS"], reason: "related" }],
  missingRequirements: ["TypeScript"],
  missingPreferred: ["GraphQL"],
  relevantExperience: [{ title: "Intern", company: "Acme", why: "Mentions react." }],
  relevantProjects: [{ name: "Feedback System", why: "React app." }],
  summary: "Decent fit.",
  resumeSuggestions: [
    { kind: "reword", text: "Lead with React.", evidenceRef: "Built in React", requirement: "" },
    {
      kind: "missing",
      text: "Your resume does not mention TypeScript.",
      evidenceRef: "",
      requirement: "TypeScript",
    },
  ],
  meta: {
    provider: "test",
    model: "test",
    promptVersion: "v1",
    ungroundedSuggestionsDropped: 0,
  },
};

function installBrowser() {
  const data = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
  Object.defineProperty(globalThis, "window", {
    value: { sessionStorage: storage, addEventListener: () => {}, removeEventListener: () => {} },
    writable: true,
    configurable: true,
  });
  return storage;
}

beforeEach(() => {
  // The store caches its snapshot at module scope, which is right in a browser
  // but would leak one test's session into the next.
  vi.resetModules();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify(analysis), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("renders every match-report section once the analysis resolves", async () => {
  const storage = installBrowser();
  storage.setItem("jobmatch:candidate", JSON.stringify(candidate));
  storage.setItem("jobmatch:jobs", JSON.stringify([job]));

  const { MatchReport } = await import("@/components/MatchReport");
  await act(async () => {
    render(<MatchReport jobId="test-1" />);
  });

  for (const heading of [
    "Matching skills",
    "Partial matches",
    "Missing requirements",
    "Relevant experience",
    "Relevant projects",
    "Resume suggestions",
  ]) {
    expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
  }
  expect(screen.getByText("50%")).toBeTruthy();
  expect(screen.getByRole("link", { name: /apply on test/i }).getAttribute("href")).toBe(job.url);
});

it("shows the resume upload prompt when no candidate is in this session", async () => {
  installBrowser();
  const { MatchReport } = await import("@/components/MatchReport");
  await act(async () => {
    render(<MatchReport jobId="test-1" />);
  });
  expect(screen.getByText(/no resume in this session/i)).toBeTruthy();
});

it("shows the stale-job prompt when the id is not in sessionStorage", async () => {
  const storage = installBrowser();
  storage.setItem("jobmatch:candidate", JSON.stringify(candidate));
  const { MatchReport } = await import("@/components/MatchReport");
  await act(async () => {
    render(<MatchReport jobId="not-a-real-id" />);
  });
  expect(screen.getByText(/no longer available in this session/i)).toBeTruthy();
});

it("surfaces an API error instead of an empty report", async () => {
  const storage = installBrowser();
  storage.setItem("jobmatch:candidate", JSON.stringify(candidate));
  storage.setItem("jobmatch:jobs", JSON.stringify([job]));
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "AI backend is not configured." }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
    ),
  );

  const { MatchReport } = await import("@/components/MatchReport");
  await act(async () => {
    render(<MatchReport jobId="test-1" />);
  });
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(screen.getByText(/AI backend is not configured/i)).toBeTruthy();
});