import type {
  Candidate,
  Job,
  JobRequirements,
  MatchAnalysis,
  MatchEvidence,
  PartialMatch,
  RelevantExperience,
  RelevantProject,
  ResumeSuggestion,
} from "@/types";
import { LIMITS, requireAiConfig, type AiConfig } from "./env";
import { ApiError } from "./http";
import { flattenCandidate, isSkillLike } from "./matching";
import {
  candidateSchema,
  jobRequirementsSchema,
  matchExplanationSchema,
  type MatchExplanation,
} from "./schema";

/** Bump when a prompt changes, so reports can be traced to the prompt that produced them. */
export const PROMPT_VERSION = "candidate-v1+requirements-v1+explanation-v1";

/**
 * Roughly 4 characters per token. A local server with a 16k context cannot take
 * a 14k-char resume and a 12k-char job listing in one prompt, so both are
 * clipped to leave room for the instructions and the JSON reply.
 */
const charsPerToken = 4;
const PROMPT_BUDGET_TOKENS = Math.max(1024, LIMITS.aiNumCtx - 2048);
const MAX_RESUME_CHARS = Math.floor(PROMPT_BUDGET_TOKENS * 0.4) * charsPerToken;
const MAX_JOB_CHARS = Math.floor(PROMPT_BUDGET_TOKENS * 0.45) * charsPerToken;

/** Keeps the head of a listing, which is where the requirements live. */
function clip(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n[listing truncated]`;
}

const SYSTEM = `You are a precise resume parser for a job-matching tool.
Return a single JSON object and nothing else. No prose, no markdown fences.
Only use information that appears in the text you are given. If a field is absent, use an empty string or an empty array. Never invent employers, degrees, dates, skills or projects.`;

const CANDIDATE_CONTRACT = `Return JSON with exactly these keys:
{
  "name": string,
  "summary": string,
  "skills": string[],
  "education": [{ "institution": string, "degree": string, "field": string, "year": string }],
  "experience": [{ "company": string, "title": string, "period": string, "highlights": string[] }],
  "projects": [{ "name": string, "description": string, "technologies": string[], "url": string }],
  "certifications": [{ "name": string, "issuer": string, "year": string }]
}
skills: concrete technologies and tools only, as written on the resume (e.g. "React", "PostgreSQL", "Git").
highlights: short factual bullets taken from the resume, not restatements of the job description.
URLs: leave empty when the resume does not show one.`;

const REQUIREMENTS_CONTRACT = `Return JSON with exactly these keys:
{
  "title": string,
  "company": string,
  "location": string,
  "experienceRequirements": string[],
  "requiredSkills": string[],
  "preferredSkills": string[],
  "educationRequirements": string[],
  "responsibilities": string[]
}
Copy the title, company and location from the listing. Extract only what the listing states.
Skills must be single technologies ("React", "TypeScript", "AWS"), not sentences.
Copy each skill exactly as the listing spells it. If a skill does not appear in the listing text, leave it out.
"requiredSkills" = must-have, from "you should apply if" / "requirements" / "you have" statements.
"preferredSkills" = nice-to-have only, from "nice to have" / "bonus" / "familiarity helps".
"experienceRequirements" = the explicit asks about years of experience or professional background.
If the listing states no education requirement, return an empty array.`;

const EXPLAIN_CONTRACT = `You explain a resume-to-job match to one person. Return JSON with exactly these keys:
{
  "summary": string,
  "matchReasons": [{ "requirement": string, "why": string }],
  "partialReasons": [{ "requirement": string, "why": string }],
  "relevantExperience": [{ "title": string, "company": string, "why": string }],
  "relevantProjects": [{ "name": string, "why": string }],
  "resumeSuggestions": [{ "kind": "reword", "text": string, "evidenceRef": string }]
}
Rules:
- The match lists are already computed. Do not add, remove or reclassify any requirement: copy each "requirement" string exactly as given.
- "why" explains using ONLY the supplied candidate evidence.
- Never claim the candidate has experience, a skill, a degree or a project that is not in the supplied candidate data.
- "relevantExperience" and "relevantProjects" must reuse the exact title/company/name strings from the candidate data.
- "resumeSuggestions" may only improve how existing resume content is presented, ordered or worded. Every suggestion must set "evidenceRef" to a short verbatim phrase copied from the candidate's own text.
- Never suggest adding a qualification, a year of experience, or a project the candidate does not already have. Never suggest "add X years of Y".
- Keep "summary" under 80 words.`;

/** Strip code fences and pull the first JSON object out of a model reply. */
function parseJson(content: string): unknown {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new SyntaxError("no JSON object in reply");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function upstreamError(status: number, cfg: AiConfig, body: string): ApiError {
  const detail = body.slice(0, 200);
  if (status === 401) {
    return new ApiError(`The AI backend rejected our credentials (${cfg.provider}).`, 502);
  }
  if (status === 403) {
    // Some providers return 403 when the key is valid but the model is not
    // enabled for the account, which is not a credentials problem.
    const blocked = /blocked|terms acceptance|not enabled/i.test(body);
    return new ApiError(
      blocked
        ? `The model "${cfg.model}" is not enabled for this ${cfg.provider} account.`
        : `The AI backend refused the request (${cfg.provider}).`,
      502,
      blocked
        ? "An org admin must enable the model in the provider dashboard, or set AI_MODEL to an enabled one."
        : "Check the API key and account limits.",
    );
  }
  if (status === 404) {
    return new ApiError(
      `The model "${cfg.model}" is not available on ${cfg.provider}.`,
      502,
      "Set AI_MODEL to a model that backend serves.",
    );
  }
  if (status === 429) {
    return new ApiError("The AI backend is rate limiting us. Please try again in a minute.", 503);
  }
  return new ApiError(
    `The AI backend returned an error (${status}).`,
    502,
    detail ? `Upstream said: ${detail}` : undefined,
  );
}

async function callModel(
  cfg: AiConfig,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  maxTokens: number,
  useJsonMode: boolean,
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      signal: AbortSignal.timeout(LIMITS.aiTimeoutMs),
      headers: {
        "content-type": "application/json",
        // Local servers ignore this; cloud gateways require it.
        ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: 0.1,
        max_tokens: maxTokens,
        ...(useJsonMode ? { response_format: { type: "json_object" } } : {}),
        // Local servers keep a KV cache across requests. A stale cache from the
        // previous prompt can corrupt the answer and holds context hostage, so
        // each call gets a fresh window of the size the server was given.
        ...(cfg.local
          ? { cache_prompt: false, options: { num_ctx: LIMITS.aiNumCtx } }
          : {}),
      }),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new ApiError(
      timedOut
        ? `The AI backend (${cfg.provider}) did not respond within ${Math.round(LIMITS.aiTimeoutMs / 1000)}s.`
        : `Could not reach the AI backend (${cfg.baseUrl}).`,
      timedOut ? 504 : 502,
      timedOut && cfg.local
        ? "Local models can be slow on CPU. Wait for it to finish loading, or raise AI_TIMEOUT_MS."
        : "Is it running, and is the base URL correct?",
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    // Some llama.cpp/Ollama builds reject response_format; retry once without it.
    if (useJsonMode && response.status === 400 && /response_format|json_object/i.test(body)) {
      return callModel(cfg, messages, maxTokens, false);
    }
    throw upstreamError(response.status, cfg, body);
  }

  const payload = (await response.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
  } | null;
  const content = payload?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new ApiError("The AI backend returned an empty response.", 502);
  return content;
}

/** One retry with an explicit correction beat, then give up with a readable error. */
async function askJson(
  cfg: AiConfig,
  prompts: { system: string; user: string },
  maxTokens: number,
): Promise<unknown> {
  const messages = [
    { role: "system" as const, content: prompts.system },
    { role: "user" as const, content: prompts.user },
  ];
  const content = await callModel(cfg, messages, maxTokens, true);
  try {
    return parseJson(content);
  } catch {
    const retry = await callModel(
      cfg,
      [
        ...messages,
        { role: "assistant", content },
        {
          role: "user",
          content: "That was not valid JSON. Reply with the same content as one valid JSON object only.",
        },
      ],
      maxTokens,
      true,
    );
    try {
      return parseJson(retry);
    } catch {
      // Do not echo model output to the user; it may contain resume text.
      throw new ApiError(
        "The AI model returned malformed JSON twice.",
        502,
        `Try a stronger model, e.g. a 7B+ instruction-tuned Gemma.`,
      );
    }
  }
}

function validated<T>(result: { success: true; data: T } | { success: false }, label: string): T {
  if (!result.success) throw new ApiError(`The AI model's ${label} output was unusable.`, 502);
  return result.data;
}

/** Stage 2: resume text -> structured candidate. */
export async function extractCandidate(resumeText: string): Promise<Candidate> {
  const cfg = requireAiConfig();
  const clipped = clip(resumeText, MAX_RESUME_CHARS);
  const raw = await askJson(
    cfg,
    {
      system: `${SYSTEM}\n\n${CANDIDATE_CONTRACT}`,
      user: `Extract the candidate profile from this resume.\n\n<resume>\n${clipped}\n</resume>`,
    },
    2048,
  );
  return validated(candidateSchema.safeParse(raw), "candidate");
}

function hasRequirements(requirements: JobRequirements): boolean {
  return (
    requirements.requiredSkills.length > 0 ||
    requirements.preferredSkills.length > 0 ||
    requirements.experienceRequirements.length > 0 ||
    requirements.educationRequirements.length > 0
  );
}

/** Stage 3: job description -> structured requirements. */
export async function extractJobRequirements(job: Job): Promise<JobRequirements> {
  const cfg = requireAiConfig();
  const prompt = {
    system: `${SYSTEM}\n\n${REQUIREMENTS_CONTRACT}`,
    user: `Extract the requirements from this job listing.\n\n<job>\nTitle: ${job.title}\nCompany: ${job.company}\nLocation: ${job.location}\n\n${clip(job.description, MAX_JOB_CHARS)}\n</job>`,
  };
  let parsed = validated(
    jobRequirementsSchema.safeParse(await askJson(cfg, prompt, 1536)),
    "job requirement",
  );

  // Weak models sometimes answer with only the title and stop, which is valid
  // JSON but an empty report. One focused retry is cheaper than a blank page.
  if (!hasRequirements(parsed)) {
    parsed = validated(
      jobRequirementsSchema.safeParse(
        await askJson(
          cfg,
          {
            system:
              "Extract the job requirements as JSON. Output the keys requiredSkills, preferredSkills, " +
              "experienceRequirements, educationRequirements and responsibilities. List every technology " +
              "the listing names. Do not stop after the title.",
            user: `${job.title} at ${job.company}\n\n${clip(job.description, MAX_JOB_CHARS)}`,
          },
          1536,
        ),
      ),
      "job requirement",
    );
  }
  // The listing itself is the source of truth for identity, not the model.
  const requirements: JobRequirements = {
    ...parsed,
    title: job.title,
    company: job.company,
    location: job.location,
  };
  // A requirement the listing never mentions is a model hallucination, not a gap
  // in the candidate's resume. Listings spell skills loosely ("JavaScript/TypeScript (ES6+)"),
  // so match on the requirement's own keywords rather than exact substring.
  const listing = job.description.toLowerCase();
  const stated = (requirement: string) => {
    const words = requirement
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/)
      .filter((word) => word.length > 1);
    return words.length > 0 && words.every((word) => listing.includes(word));
  };
  const skills = (items: string[]) => items.filter((item) => stated(item) && isSkillLike(item));
  return {
    ...requirements,
    requiredSkills: skills(requirements.requiredSkills),
    preferredSkills: skills(requirements.preferredSkills),
    experienceRequirements: requirements.experienceRequirements.filter(stated),
    educationRequirements: requirements.educationRequirements.filter(stated),
  };
}

type ExplainedMatch = {
  summary: string;
  matches: MatchEvidence[];
  partialMatches: PartialMatch[];
  relevantExperience: RelevantExperience[];
  relevantProjects: RelevantProject[];
  resumeSuggestions: ResumeSuggestion[];
  dropped: number;
};

/** One line per candidate item that the model is allowed to talk about. */
function candidateBrief(candidate: Candidate): string {
  const lines = [
    `Name: ${candidate.name}`,
    `Skills: ${candidate.skills.join(", ")}`,
  ];
  candidate.experience.forEach((item, index) => {
    lines.push(
      `Experience ${index + 1}: ${item.title} at ${item.company} (${item.period}) — ${item.highlights.join("; ")}`,
    );
  });
  candidate.projects.forEach((item, index) => {
    lines.push(`Project ${index + 1}: ${item.name} — ${item.description} [${item.technologies.join(", ")}]`);
  });
  candidate.education.forEach((item, index) => {
    lines.push(`Education ${index + 1}: ${item.degree} ${item.field} at ${item.institution} (${item.year})`);
  });
  candidate.certifications.forEach((item, index) => {
    lines.push(`Certification ${index + 1}: ${item.name} (${item.issuer}, ${item.year})`);
  });
  return lines.join("\n");
}

/** Stage 5: explain the deterministic match. Cannot add facts; can only select and reword. */
export async function explainMatch(args: {
  candidate: Candidate;
  analysis: Omit<MatchAnalysis, "summary" | "resumeSuggestions" | "meta">;
}): Promise<ExplainedMatch> {
  const cfg = requireAiConfig();
  const { candidate, analysis } = args;
  const job = analysis.job;
  const payload = {
    candidate: candidateBrief(candidate),
    job: { title: job.title, company: job.company, location: job.location },
    computed: {
      matches: analysis.matches.map((m) => ({ requirement: m.requirement, evidence: m.evidence })),
      partialMatches: analysis.partialMatches.map((m) => ({ requirement: m.requirement, evidence: m.evidence })),
      missingRequirements: analysis.missingRequirements,
      missingPreferred: analysis.missingPreferred,
      shortlist: {
        experience: analysis.relevantExperience.map((e) => `${e.title} at ${e.company}`),
        projects: analysis.relevantProjects.map((p) => p.name),
      },
    },
  };

  const raw = await askJson(
    cfg,
    {
      system: `${SYSTEM}\n\n${EXPLAIN_CONTRACT}`,
      user: `Explain this match for the candidate.\n\n${JSON.stringify(payload, null, 1)}`,
    },
    2048,
  );
  const explained: MatchExplanation = validated(matchExplanationSchema.safeParse(raw), "explanation");

  const requirementSet = new Set([
    ...analysis.matches.map((m) => m.requirement),
    ...analysis.partialMatches.map((m) => m.requirement),
  ]);
  const whyFor = (reasons: { requirement: string; why: string }[]) => {
    const map = new Map<string, string>();
    for (const reason of reasons) {
      const key = reason.requirement.trim().toLowerCase();
      if (reason.why.trim() && requirementSet.has(key)) {
        map.set(reason.requirement.trim(), reason.why.trim());
      }
    }
    return map;
  };

  const matchWhy = whyFor(explained.matchReasons);
  const partialWhy = whyFor(explained.partialReasons);

  const matches = analysis.matches.map((m) => ({
    ...m,
    evidence: matchWhy.has(m.requirement) ? [matchWhy.get(m.requirement)!, ...m.evidence] : m.evidence,
  }));
  const partialMatches = analysis.partialMatches.map((m) => ({
    ...m,
    reason: partialWhy.get(m.requirement) ?? m.reason,
  }));

  // Model-selected items must exist on the resume, by exact title/company/name.
  const experienceKeys = new Set(
    candidate.experience.map((e) => `${e.title.toLowerCase()} @ ${e.company.toLowerCase()}`),
  );
  const projectNames = new Set(candidate.projects.map((p) => p.name.toLowerCase()));
  const chosenExperience = new Set(
    explained.relevantExperience
      .filter((e) => e.why.trim() && experienceKeys.has(`${e.title.toLowerCase()} @ ${e.company.toLowerCase()}`))
      .map((e) => `${e.title.toLowerCase()} @ ${e.company.toLowerCase()}`),
  );
  const chosenProjects = new Set(
    explained.relevantProjects
      .filter((p) => p.why.trim() && projectNames.has(p.name.toLowerCase()))
      .map((p) => p.name.toLowerCase()),
  );
  // Keep the deterministic shortlist as a floor so a terse model never loses signal.
  const relevantExperience = [
    ...explained.relevantExperience.filter((e) =>
      chosenExperience.has(`${e.title.toLowerCase()} @ ${e.company.toLowerCase()}`),
    ),
    ...analysis.relevantExperience.filter((e) => !chosenExperience.has(`${e.title.toLowerCase()} @ ${e.company.toLowerCase()}`)),
  ];
  const relevantProjects = [
    ...explained.relevantProjects.filter((p) => chosenProjects.has(p.name.toLowerCase())),
    ...analysis.relevantProjects.filter((p) => !chosenProjects.has(p.name.toLowerCase())),
  ];

  // Resume integrity: a suggestion survives only if it points at real resume text.
  const resumeText = flattenCandidate(candidate).toLowerCase();
  let dropped = 0;
  const grounded: ResumeSuggestion[] = [];
  for (const suggestion of explained.resumeSuggestions) {
    const evidence = suggestion.evidenceRef.trim().toLowerCase();
    if (!suggestion.text.trim() || evidence.length < 3 || !resumeText.includes(evidence)) {
      dropped += 1;
      continue;
    }
    grounded.push({
      kind: "reword",
      text: suggestion.text.trim(),
      evidenceRef: suggestion.evidenceRef.trim(),
      requirement: "",
    });
  }
  // Missing items are generated here, not by the model, so they cannot be fabricated.
  const missingSuggestions: ResumeSuggestion[] = analysis.missingRequirements.slice(0, 6).map((requirement) => ({
    kind: "missing",
    text: `Your resume does not mention ${requirement}. Leave it out unless it is genuinely true — otherwise treat it as a gap to close or learn.`,
    evidenceRef: "",
    requirement,
  }));

  return {
    summary: explained.summary.trim(),
    matches,
    partialMatches,
    relevantExperience,
    relevantProjects,
    resumeSuggestions: [...grounded, ...missingSuggestions],
    dropped,
  };
}

/**
 * Connectivity probe for the status endpoint. It sends a miniature version of the
 * real stage-2 call, because a degenerate prompt like {"ok":true} is one that
 * some small open-weight models answer with an immediate end-of-turn.
 */
export async function probeAi(): Promise<{ reachable: boolean; error: string | null }> {
  try {
    const cfg = requireAiConfig();
    const content = await callModel(
      cfg,
      [
        { role: "system", content: 'Return a single JSON object with the key "ok" set to true.' },
        {
          role: "user",
          content: 'Confirm the JSON output works by returning the object {"ok":true}.',
        },
      ],
      512,
      false,
    );
    if (parseJson(content) === null) {
      return { reachable: false, error: "The AI backend returned no JSON." };
    }
    return { reachable: true, error: null };
  } catch (error) {
    return { reachable: false, error: error instanceof ApiError ? error.message : "AI backend failed." };
  }
}