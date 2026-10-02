import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { ResumeUpload } from "@/components/ResumeUpload";
import { useCandidate } from "@/lib/store";
import type { Candidate } from "@/types";

/**
 * Regression: getSnapshot returned a fresh object each call, so
 * useSyncExternalStore re-rendered forever and React threw
 * "Maximum update depth exceeded" the moment a resume was loaded.
 */

const candidate: Candidate = {
  name: "Priya Sharma",
  summary: "Frontend developer.",
  skills: ["React", "JavaScript", "React", "python", "Python"],
  education: [],
  experience: [],
  projects: [],
  certifications: [],
};

function renderWithCandidate() {
  const store: Record<string, string> = {};
  const storage: Storage = {
    get length() {
      return Object.keys(store).length;
    },
    clear: () => {
      for (const key of Object.keys(store)) delete store[key];
    },
    getItem: (key: string) => store[key] ?? null,
    key: (index: number) => Object.keys(store)[index] ?? null,
    removeItem: (key: string) => void delete store[key],
    setItem: (key: string, value: string) => void (store[key] = value),
  };

  const previous = (globalThis as { window?: unknown }).window;
  Object.defineProperty(globalThis, "window", {
    value: { sessionStorage: storage, addEventListener: () => {}, removeEventListener: () => {} },
    writable: true,
    configurable: true,
  });
  storage.setItem("jobmatch:candidate", JSON.stringify(candidate));

  return { previous };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Probe() {
  const value = useCandidate();
  return <span data-testid="name">{value?.name ?? "none"}</span>;
}

it("renders the candidate without an update loop", async () => {
  const { previous } = renderWithCandidate();
  // Would throw "Maximum update depth exceeded" if the snapshot were unstable.
  await act(async () => {
    render(<Probe />);
  });
  expect(screen.getByTestId("name").textContent).toBe("Priya Sharma");
  Object.defineProperty(globalThis, "window", { value: previous, writable: true, configurable: true });
});

it("renders the upload form without touching the store loop", async () => {
  await act(async () => {
    render(<ResumeUpload />);
  });
  expect(screen.getByLabelText(/resume pdf/i)).toBeTruthy();
});
it("renders duplicate skills once, without duplicate-key warnings", async () => {
  const warn = vi.spyOn(console, "error").mockImplementation(() => {});
  const previous = (globalThis as { window?: unknown }).window;
  const { CandidateProfile } = await import("@/components/CandidateProfile");
  await act(async () => {
    render(<CandidateProfile candidate={candidate} />);
  });
  const chips = screen.getAllByText(/React/).filter((n) => n.textContent === "React");
  expect(chips).toHaveLength(1);
  expect(warn.mock.calls.flat().join(" ")).not.toMatch(/same key/i);
  Object.defineProperty(globalThis, "window", { value: previous, writable: true, configurable: true });
});
