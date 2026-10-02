import { describe, expect, it } from "vitest";
import { dedupeKey, matchesMode, matchesTerms, queryTerms, slug, stripHtml } from "@/lib/job-utils";
import type { Job } from "@/types";

const job = (overrides: Partial<Job> = {}): Job => ({
  id: "arbeitnow-1",
  title: "Frontend Developer",
  company: "Acme",
  location: "Berlin",
  description: "Build React interfaces.",
  url: "https://example.com",
  source: "Arbeitnow",
  employmentType: "Full-time",
  remote: false,
  tags: ["Software Engineering"],
  ...overrides,
});

describe("stripHtml", () => {
  it("removes tags and decodes entities", () => {
    expect(stripHtml("<p>Hello &amp; welcome</p>")).toBe("Hello & welcome");
  });

  it("keeps block boundaries as line breaks", () => {
    expect(stripHtml("<ul><li>One</li><li>Two</li></ul>")).toBe("One\nTwo");
  });

  it("drops scripts entirely", () => {
    expect(stripHtml("<script>alert(1)</script><p>Safe</p>")).toBe("Safe");
  });
});

describe("query matching", () => {
  it("requires every term to appear somewhere in the listing", () => {
    const listing = job({ description: "React and TypeScript required." });
    expect(matchesTerms(listing, queryTerms("react typescript"))).toBe(true);
    expect(matchesTerms(listing, queryTerms("react kubernetes"))).toBe(false);
  });

  it("matches on tags as well as description", () => {
    expect(matchesTerms(job({ description: "", tags: ["Java"] }), queryTerms("java"))).toBe(true);
  });
});

describe("work mode and location filters", () => {
  it("keeps remote jobs for the remote filter", () => {
    expect(matchesMode(job({ remote: true }), "remote")).toBe(true);
    expect(matchesMode(job({ remote: false }), "remote")).toBe(false);
  });

  it("detects hybrid from location text", () => {
    expect(matchesMode(job({ location: "Berlin (Hybrid)" }), "hybrid")).toBe(true);
    expect(matchesMode(job({ location: "Berlin" }), "hybrid")).toBe(false);
  });

  it("excludes remote jobs from the on-site filter", () => {
    expect(matchesMode(job({ remote: true }), "onsite")).toBe(false);
  });

  it("filters by location substring, case-insensitively", () => {
    expect(matchesMode(job(), "any")).toBe(true);
    expect(matchesMode(job({ location: "Kolkata, India" }), "any")).toBe(true);
  });
});

describe("dedupeKey", () => {
  it("gives the same key for the same title and company regardless of spacing", () => {
    expect(dedupeKey(job({ title: "Frontend  Developer" }))).toBe(dedupeKey(job()));
  });

  it("differs when the company differs", () => {
    expect(dedupeKey(job({ company: "Other" }))).not.toBe(dedupeKey(job()));
  });
});

describe("slug", () => {
  it("produces a url-safe token", () => {
    expect(slug("Senior Frontend (React)")).toBe("senior-frontend-react");
  });
});