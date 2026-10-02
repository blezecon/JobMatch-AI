import { expect, it } from "vitest";
import { describeAi, requireAiConfig } from "@/lib/env";
import { ApiError } from "@/lib/http";
import { PROMPT_VERSION } from "@/lib/ai";
import { matchCandidateToJob } from "@/lib/matching";
import type { Candidate, Job, JobRequirements } from "@/types";

// These exercise the real code paths against a fake OpenAI-compatible server:
// no network, no live model.

const candidate: Candidate = {
  name: "Ada Lovelace",
  summary: "Frontend developer focused on data dashboards.",
  skills: ["JavaScript", "React", "Git"],
  education: [
    { institution: "University of Calcutta", degree: "B.Tech", field: "Computer Science", year: "2024" },
  ],
  experience: [
    {
      company: "Acme",
      title: "Frontend Developer Intern",
      period: "2023",
      highlights: ["Built a Student Feedback System in React"],
    },
  ],
  projects: [
    {
      name: "Student Feedback System",
      description: "Collected course feedback from 500 students.",
      technologies: ["React"],
      url: "",
    },
  ],
  certifications: [],
};

const job: Job = {
  id: "test-1",
  title: "Frontend Developer",
  company: "Globex",
  location: "Remote",
  description: "We need React and JavaScript. TypeScript and Next.js nice to have.",
  url: "https://example.com/job",
  source: "Test",
  employmentType: "Full-time",
  remote: true,
  tags: [],
};

const requirements: JobRequirements = {
  title: job.title,
  company: job.company,
  location: job.location,
  experienceRequirements: ["2+ years of professional frontend experience"],
  requiredSkills: ["React", "JavaScript", "TypeScript"],
  preferredSkills: ["Next.js"],
  educationRequirements: [],
  responsibilities: [],
};

// Captures the request so tests can assert on the wire contract.
type Captured = { body: Record<string, unknown>; url: string; auth: string | null };

function fakeBackend(
  reply: (captured: Captured) => string | { status: number; body: string },
): { restore: () => void; captured: Captured[] } {
  const captured: Captured[] = [];
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  process.env.AI_PROVIDER = "groq";
  process.env.GROQ_API_KEY = "test-key";
  delete process.env.AI_BASE_URL;
  delete process.env.AI_MODEL;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    const record: Captured = {
      body,
      url: String(input),
      auth: (init?.headers as Record<string, string> | undefined)?.authorization ?? null,
    };
    captured.push(record);
    const result = reply(record);
    if (typeof result !== "string") {
      return new Response(result.body, { status: result.status });
    }
    return new Response(
      JSON.stringify({ choices: [{ message: { content: result } }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  return {
    captured,
    restore: () => {
      globalThis.fetch = originalFetch;
      process.env = originalEnv;
    },
  };
}

/** The raw text an OpenAI-compatible backend would put in message.content. */
const chatReply = (payload: unknown) => JSON.stringify(payload);

const candidateJson = {
  name: "Ada Lovelace",
  summary: "Frontend developer.",
  skills: ["JavaScript", "React", "Git"],
  education: [{ institution: "University of Calcutta", degree: "B.Tech", field: "Computer Science", year: "2024" }],
  experience: [
    { company: "Acme", title: "Frontend Developer Intern", period: "2023", highlights: ["Built a React dashboard"] },
  ],
  projects: [{ name: "Student Feedback System", description: "Feedback app", technologies: ["React"], url: "" }],
  certifications: [],
};

const requirementsJson = {
  title: job.title,
  company: job.company,
  location: job.location,
  experienceRequirements: ["2+ years of professional frontend experience"],
  requiredSkills: ["React", "JavaScript", "TypeScript"],
  preferredSkills: ["Next.js"],
  educationRequirements: [],
  responsibilities: ["Build UI"],
};

it("sends an authenticated request to the configured OpenAI-compatible endpoint", async () => {
  const backend = fakeBackend(() => chatReply(candidateJson));
  try {
    await import("@/lib/ai").then((m) => m.extractCandidate("resume text"));
    expect(backend.captured).toHaveLength(1);
    expect(backend.captured[0].url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(backend.captured[0].auth).toBe("Bearer test-key");
    expect(backend.captured[0].body.response_format).toEqual({ type: "json_object" });
    expect(backend.captured[0].body.model).toBeTruthy();
  } finally {
    backend.restore();
  }
});

it("retries once and repairs malformed JSON", async () => {
  let call = 0;
  const backend = fakeBackend(() => {
    call += 1;
    return call === 1 ? "here you go: not json at all" : chatReply(candidateJson);
  });
  try {
    const result = await import("@/lib/ai").then((m) => m.extractCandidate("resume"));
    expect(call).toBe(2);
    expect(result.name).toBe("Ada Lovelace");
  } finally {
    backend.restore();
  }
});

it("fails cleanly when the model never returns valid JSON", async () => {
  const backend = fakeBackend(() => "still not json");
  try {
    const { extractCandidate } = await import("@/lib/ai");
    await expect(extractCandidate("resume")).rejects.toThrow(ApiError);
    await expect(extractCandidate("resume")).rejects.toThrow(/malformed JSON/i);
  } finally {
    backend.restore();
  }
});

it("never echoes model output in the malformed-JSON error", async () => {
  const secret = "SUPERSECRETNAME Ada Lovelace";
  const backend = fakeBackend(() => secret);
  try {
    const { extractCandidate } = await import("@/lib/ai");
    await expect(extractCandidate("resume")).rejects.toThrow(
      expect.objectContaining({ message: expect.not.stringContaining(secret) }),
    );
  } finally {
    backend.restore();
  }
});

it("maps a rejected key to a readable error", async () => {
  const backend = fakeBackend(() => ({ status: 401, body: "invalid api key" }));
  try {
    const { extractCandidate } = await import("@/lib/ai");
    await expect(extractCandidate("resume")).rejects.toThrow(/rejected our credentials/i);
  } finally {
    backend.restore();
  }
});

it("distinguishes a disabled model from a bad key", async () => {
  // Groq answers 403 both for "org has not enabled this model" and for refused
  // credentials; only the first is fixable by changing AI_MODEL.
  const blocked = fakeBackend(() => ({
    status: 403,
    body: "The model `openai/gpt-oss-20b` is blocked at the organization level.",
  }));
  try {
    const { extractCandidate } = await import("@/lib/ai");
    const error = await extractCandidate("resume").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/not enabled for this groq account/i);
    expect((error as Error).message).not.toMatch(/credentials/i);
  } finally {
    blocked.restore();
  }
});

it("reads a plain 403 as a permissions problem", async () => {
  const forbidden = fakeBackend(() => ({ status: 403, body: "forbidden" }));
  try {
    const { extractCandidate } = await import("@/lib/ai");
    await expect(extractCandidate("resume")).rejects.toThrow(/refused the request/i);
  } finally {
    forbidden.restore();
  }
});

it("reports a rate limit as retryable", async () => {
  const limited = fakeBackend(() => ({ status: 429, body: "rate limit exceeded" }));
  try {
    const { extractCandidate } = await import("@/lib/ai");
    await expect(extractCandidate("resume")).rejects.toThrow(/rate limiting/i);
  } finally {
    limited.restore();
  }
});

it("never puts the API key in an error message", async () => {
  const refused = fakeBackend(() => ({ status: 401, body: "invalid api key gsk_leaked_here" }));
  try {
    const { extractCandidate } = await import("@/lib/ai");
    const error = await extractCandidate("resume").catch((e: unknown) => e);
    expect((error as Error).message).not.toContain("gsk_");
  } finally {
    refused.restore();
  }
});

it("names the model when the backend does not serve it", async () => {
  const backend = fakeBackend(() => ({ status: 404, body: "model not found" }));
  try {
    const { extractCandidate } = await import("@/lib/ai");
    await expect(extractCandidate("resume")).rejects.toThrow(/is not available on groq/i);
  } finally {
    backend.restore();
  }
});

it("drops the model output for title and company, keeping the listing as truth", async () => {
  const backend = fakeBackend(() =>
    chatReply({ ...requirementsJson, title: "Invented Title", company: "Invented Co" }),
  );
  try {
    const { extractJobRequirements } = await import("@/lib/ai");
    const result = await extractJobRequirements(job);
    expect(result.title).toBe(job.title);
    expect(result.company).toBe(job.company);
  } finally {
    backend.restore();
  }
});

it("discards resume suggestions that are not grounded in the resume text", async () => {
  const backend = fakeBackend(() => {
    const computed = matchCandidateToJob(candidate, requirements);
    return chatReply({
      summary: "Good fit on the core frontend stack.",
      matchReasons: [{ requirement: "React", why: "You built a React dashboard." }],
      partialReasons: [],
      relevantExperience: [
        { title: "Frontend Developer Intern", company: "Acme", why: "Shipped React UI." },
      ],
      relevantProjects: [{ name: "Student Feedback System", why: "React app with real users." }],
      resumeSuggestions: [
        // Grounded: this phrase is in the candidate's own experience highlight.
        {
          kind: "reword",
          text: "Lead with your React work.",
          evidenceRef: "Student Feedback System in React",
        },
        // Ungrounded: the resume never mentions Kubernetes.
        { kind: "reword", text: "Claim 5 years of Kubernetes experience.", evidenceRef: "Kubernetes" },
        { kind: "reword", text: "Invent a promotion.", evidenceRef: "" },
      ],
      computedScore: computed.fitScore,
    });
  });
  try {
    const { explainMatch } = await import("@/lib/ai");
    const result = await explainMatch({
      candidate,
      analysis: { job, requirements, ...matchCandidateToJob(candidate, requirements) },
    });
    const texts = result.resumeSuggestions.map((s) => s.text);
    expect(texts).toContain("Lead with your React work.");
    expect(texts.some((t) => /Kubernetes/.test(t))).toBe(false);
    expect(result.dropped).toBe(2);
    // Missing items are generated deterministically, never by the model.
    expect(result.resumeSuggestions.some((s) => s.kind === "missing")).toBe(true);
    expect(result.relevantExperience[0].company).toBe("Acme");
  } finally {
    backend.restore();
  }
});

it("rejects explanation items that invent resume entries", async () => {
  const backend = fakeBackend(() =>
    chatReply({
      summary: "x",
      relevantExperience: [
        { title: "Senior Architect", company: "Google", why: "Invented." },
        { title: "Frontend Developer Intern", company: "Acme", why: "Real." },
      ],
      relevantProjects: [{ name: "Totally Made Up Project", why: "Invented." }],
      resumeSuggestions: [],
    }),
  );
  try {
    const { explainMatch } = await import("@/lib/ai");
    const result = await explainMatch({
      candidate,
      analysis: { job, requirements, ...matchCandidateToJob(candidate, requirements) },
    });
    expect(result.relevantExperience.some((e) => e.company === "Google")).toBe(false);
    expect(result.relevantProjects.some((p) => p.name === "Totally Made Up Project")).toBe(false);
  } finally {
    backend.restore();
  }
});

it("records the prompt version", () => {
  expect(PROMPT_VERSION).toMatch(/v1/);
});

it("fails with a hint when no API key is configured", () => {
  const original = { ...process.env };
  process.env.AI_PROVIDER = "groq";
  delete process.env.GROQ_API_KEY;
  try {
    expect(() => requireAiConfig()).toThrow(/No API key/i);
    expect(describeAi().configured).toBe(false);
  } finally {
    process.env = original;
  }
});

it("rejects an unsupported backend name", () => {
  const original = { ...process.env };
  process.env.AI_PROVIDER = "not-a-backend";
  try {
    expect(() => requireAiConfig()).toThrow(/not a supported backend/i);
  } finally {
    process.env = original;
  }
});

it("honours a per-backend BASE_URL for every provider", () => {
  // Regression: LLAMACPP_BASE_URL was documented but never read, so a remote
  // llama-server was silently ignored in favour of the localhost default.
  const original = { ...process.env };
  process.env = { ...original, AI_PROVIDER: "llamacpp", LLAMACPP_BASE_URL: "http://192.168.29.136:8080/v1" };
  delete process.env.AI_BASE_URL;
  try {
    expect(requireAiConfig().baseUrl).toBe("http://192.168.29.136:8080/v1");
  } finally {
    process.env = original;
  }
});

it("honours a per-backend MODEL for every provider", () => {
  const original = { ...process.env };
  process.env = { ...original, AI_PROVIDER: "llamacpp", LLAMACPP_MODEL: "phi4.gguf" };
  delete process.env.AI_MODEL;
  try {
    expect(requireAiConfig().model).toBe("phi4.gguf");
  } finally {
    process.env = original;
  }
});

it("lets AI_BASE_URL win over the per-backend variable", () => {
  const original = { ...process.env };
  process.env = {
    ...original,
    AI_PROVIDER: "llamacpp",
    LLAMACPP_BASE_URL: "http://per-backend:8080/v1",
    AI_BASE_URL: "http://generic:9000/v1/",
  };
  try {
    // Trailing slashes are stripped so the composed path never doubles up.
    expect(requireAiConfig().baseUrl).toBe("http://generic:9000/v1");
  } finally {
    process.env = original;
  }
});

it("marks local backends as local so the UI can say the resume stays put", () => {
  const original = { ...process.env };
  process.env.AI_PROVIDER = "ollama";
  delete process.env.AI_BASE_URL;
  try {
    expect(requireAiConfig().local).toBe(true);
    expect(requireAiConfig().baseUrl).toContain("11434");
  } finally {
    process.env = original;
  }
});