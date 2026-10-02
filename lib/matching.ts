import type {
  Candidate,
  JobRequirements,
  MatchEvidence,
  PartialMatch,
  RelevantExperience,
  RelevantProject,
} from "@/types";

/**
 * Stage 4 is pure code, on purpose. The language model extracts and explains,
 * but the match/partial/missing decision is arithmetic over strings so the same
 * input always produces the same report.
 */

/** Aliases collapse the many spellings of the same technology. */
const ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  reactjs: "react",
  "react.js": "react",
  nextjs: "next.js",
  node: "node.js",
  nodejs: "node.js",
  expressjs: "express",
  vuejs: "vue",
  postgres: "postgresql",
  psql: "postgresql",
  mongo: "mongodb",
  k8s: "kubernetes",
  "google cloud": "gcp",
  "amazon web services": "aws",
  jsx: "jsx",
  html5: "html",
  css3: "css",
  golang: "go",
  cplusplus: "c++",
  py: "python",
  "sklearn": "scikit-learn",
  tf: "tensorflow",
};

const STOPWORDS = new Set([
  "and", "or", "the", "with", "for", "of", "in", "to", "a", "an", "on", "at", "using",
  "years", "year", "experience", "work", "working", "knowledge", "familiar", "solid",
  "good", "strong", "able", "you", "your", "we", "our", "must", "should", "will", "have",
  "has", "have", "plus", "etc", "any", "all", "other", "others", "such", "well", "good",
]);

export function normalizeSkill(raw: string): string {
  const lowered = raw
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/[^a-z0-9+#./ -]/g, " ")
    .replace(/\s*\/\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const stripped = lowered.replace(/\.$/, "");
  return ALIASES[stripped] ?? ALIASES[stripped.replace(/[./]/g, "")] ?? stripped;
}

function skillTokens(value: string): string[] {
  return normalizeSkill(value)
    .split(" ")
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

/**
 * Words that show up in postings as nouns but are not technologies. A model asked
 * for "requiredSkills" will hand back "accessibility" or "problem solving"; treating
 * those as skills produces a 0% fit for someone who plainly matches the stack.
 */
const NON_SKILLS = new Set([
  "usability", "accessibility", "performance", "maintainability", "reliability",
  "scalability", "readability", "testability", "observability", "security",
  "communication", "collaboration", "teamwork", "problem", "problems", "solving",
  "ownership", "mindset", "culture", "quality", "impact", "ownership", "drive",
  "judgment", "craft", "curiosity", "learning", "attention", "detail", "skills",
  "experience", "knowledge", "ability", "expertise", "understanding", "familiarity",
]);

export function isSkillLike(requirement: string): boolean {
  const normalized = normalizeSkill(requirement);
  if (!normalized) return false;
  if (NON_SKILLS.has(normalized)) return false;
  // "problem solving", "communication skills": every word is a non-skill noun.
  const words = normalized.split(" ").filter(Boolean);
  if (words.length === 0 || words.every((word) => NON_SKILLS.has(word))) return false;
  // A requirement the model copied as a whole sentence is not a skill, however it
  // is spelled, so this also catches non-English listings. Counted on the raw
  // string too, since normalisation drops words it cannot read. Punctuation only
  // counts as a sentence break, never the dot inside "Node.js".
  const rawWords = requirement.trim().split(/\s+/).filter(Boolean);
  return rawWords.length <= 4 && words.length <= 4 && !/[.,;:](\s|$)/.test(requirement.trim());
}

export type MatchLevel = "match" | "partial" | "none";

/**
 * match    — the normalized candidate skill is exactly what the posting asks for
 *            ("React" vs "reactjs", "Node" vs "Node.js")
 * partial  — they share a whole word but are not the same skill
 *            ("React" vs "React Native", "Docker" vs "Docker and Kubernetes")
 * none     — nothing in common
 *
 * Deliberately conservative: loose substring matching would call "Java" a hit
 * for "JavaScript" and report experience the resume does not have.
 */
export function matchSkill(candidateSkills: string[], requirement: string): MatchLevel {
  const normalized = candidateSkills.map(normalizeSkill).filter(Boolean);
  const target = normalizeSkill(requirement);
  if (!target) return "none";

  if (normalized.includes(target)) return "match";

  const targetTokens = skillTokens(target);
  if (targetTokens.length === 0) return "none";

  // "JavaScript in production" is fully covered by a candidate who has JavaScript.
  const owned = new Set(normalized.flatMap(skillTokens));
  if (targetTokens.every((token) => owned.has(token))) return "match";

  for (const skill of normalized) {
    if (skillTokens(skill).some((token) => targetTokens.includes(token))) return "partial";
  }
  return "none";
}

type DeterministicMatch = {
  matches: MatchEvidence[];
  partialMatches: PartialMatch[];
  missingRequirements: string[];
  missingPreferred: string[];
  relevantExperience: RelevantExperience[];
  relevantProjects: RelevantProject[];
  fitScore: number;
};

function evidenceFor(candidateSkills: string[], requirement: string, level: MatchLevel): string[] {
  if (level === "none") return [];
  return candidateSkills.filter((skill) => matchSkill([skill], requirement) === level);
}

function describePartial(skill: string, requirement: string): string {
  const shared = skillTokens(skill).filter((token) => skillTokens(requirement).includes(token));
  const common = shared.length ? shared.join(", ") : skill;
  return `You list ${skill}, which shares "${common}" with the ${requirement} requirement — related, but not the same skill.`;
}

/** Which candidate items mention any of the skills this posting wants. */
function shortlist(candidate: Candidate, terms: string[]): { matchedTerms: string[] } {
  const normalizedTerms = terms.map(normalizeSkill).filter(Boolean);
  const matchedTerms: string[] = [];
  const mentions = (haystack: string) => {
    const text = haystack.toLowerCase();
    const hits = normalizedTerms.filter((term) => term && text.includes(term));
    matchedTerms.push(...hits);
    return hits;
  };
  for (const item of candidate.experience) {
    mentions([item.title, item.company, ...item.highlights].join(" "));
  }
  for (const item of candidate.projects) {
    mentions([item.name, item.description, ...item.technologies].join(" "));
  }
  return { matchedTerms: [...new Set(matchedTerms)] };
}

export function matchCandidateToJob(candidate: Candidate, requirements: JobRequirements): DeterministicMatch {
  const skills = candidate.skills;
  const matches: MatchEvidence[] = [];
  const partialMatches: PartialMatch[] = [];
  const missingRequirements: string[] = [];
  // A skill listed as both required and preferred must be reported once.
  const decided = new Set<string>();

  const record = (requirement: string, level: MatchLevel) => {
    const key = normalizeSkill(requirement);
    if (decided.has(key)) return;
    decided.add(key);
    if (level === "match") {
      matches.push({ requirement, evidence: evidenceFor(skills, requirement, level) });
    } else if (level === "partial") {
      const evidence = evidenceFor(skills, requirement, level);
      partialMatches.push({
        requirement,
        evidence,
        reason: evidence.length
          ? describePartial(evidence[0], requirement)
          : "Related, but not directly evidenced on the resume.",
      });
    } else {
      missingRequirements.push(requirement);
    }
  };

  // Non-skill asks (years of experience, degrees) go through the same matcher:
  // satisfied only if the resume actually names a matching technology.
  const groups: { items: string[]; onPartial: boolean }[] = [
    { items: requirements.requiredSkills, onPartial: true },
    { items: requirements.experienceRequirements, onPartial: true },
    { items: requirements.educationRequirements, onPartial: true },
  ];

  for (const group of groups) {
    for (const requirement of dedupe(group.items)) {
      const level = matchSkill(skills, requirement);
      // A partial match on a non-skill ask is still partial, not missing.
      record(requirement, level === "partial" && !group.onPartial ? "partial" : level);
    }
  }

  const missingPreferred: string[] = [];
  for (const requirement of dedupe(requirements.preferredSkills)) {
    const level = matchSkill(skills, requirement);
    if (level === "match" || level === "partial") {
      record(requirement, level);
    } else if (!decided.has(normalizeSkill(requirement))) {
      decided.add(normalizeSkill(requirement));
      missingPreferred.push(requirement);
    }
  }

  const { matchedTerms } = shortlist(candidate, [
    ...matches.map((m) => m.requirement),
    ...partialMatches.map((p) => p.requirement),
  ]);

  const relevantExperience: RelevantExperience[] = candidate.experience
    .map((item) => {
      const haystack = [item.title, item.company, ...item.highlights].join(" ").toLowerCase();
      const hits = matchedTerms.filter((term) => haystack.includes(term));
      return { item, hits };
    })
    .filter(({ hits }) => hits.length > 0)
    .slice(0, 4)
    .map(({ item, hits }) => ({
      title: item.title,
      company: item.company,
      why: `Mentions ${hits.slice(0, 3).join(", ")}.`,
    }));

  const relevantProjects: RelevantProject[] = candidate.projects
    .map((item) => {
      const haystack = [item.name, item.description, ...item.technologies].join(" ").toLowerCase();
      const hits = matchedTerms.filter((term) => haystack.includes(term));
      return { item, hits };
    })
    .filter(({ hits }) => hits.length > 0)
    .slice(0, 4)
    .map(({ item, hits }) => ({
      name: item.name,
      why: hits.length
        ? `Built with ${hits.slice(0, 3).join(", ")}.`
        : "Closest project on the resume.",
    }));

  // ponytail: a straight coverage ratio over the required skills, not a learned
  // score. Preferred skills never move the number, so an unmet "nice to have"
// cannot cost a candidate points. Some postings name no required skills at all,
// in which case preferred coverage is the only signal available.
  const covered = (list: string[]) =>
    list.filter((skill) =>
      matches.some((match) => normalizeSkill(match.requirement) === normalizeSkill(skill)),
    ).length;
  const requiredSkills = dedupe(requirements.requiredSkills);
  const preferredSkills = dedupe(requirements.preferredSkills);
  const basis = requiredSkills.length ? requiredSkills : preferredSkills;
  const fitScore = basis.length ? Math.round((covered(basis) / basis.length) * 100) : 0;

  return {
    matches,
    partialMatches: partialMatches.slice(0, 20),
    missingRequirements: missingRequirements.slice(0, 20),
    missingPreferred: missingPreferred.slice(0, 12),
    relevantExperience,
    relevantProjects,
    fitScore,
  };
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const trimmed = item.trim();
    const key = normalizeSkill(trimmed);
    if (!trimmed || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

/** Everything the candidate actually wrote, used to ground suggestions. */
export function flattenCandidate(candidate: Candidate): string {
  return [
    candidate.name,
    candidate.summary,
    candidate.skills.join(" "),
    candidate.experience.flatMap((e) => [e.company, e.title, e.period, ...e.highlights]).join(" "),
    candidate.projects.flatMap((p) => [p.name, p.description, ...p.technologies]).join(" "),
    candidate.education.flatMap((e) => [e.institution, e.degree, e.field, e.year]).join(" "),
    candidate.certifications.map((c) => `${c.name} ${c.issuer} ${c.year}`).join(" "),
  ].join("\n");
}