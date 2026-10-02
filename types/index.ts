export type WorkMode = "remote" | "hybrid" | "onsite";

export type Education = {
  institution: string;
  degree: string;
  field: string;
  year: string;
};

export type Experience = {
  company: string;
  title: string;
  period: string;
  highlights: string[];
};

export type Project = {
  name: string;
  description: string;
  technologies: string[];
  url: string;
};

export type Certification = {
  name: string;
  issuer: string;
  year: string;
};

export type Candidate = {
  name: string;
  summary: string;
  skills: string[];
  education: Education[];
  experience: Experience[];
  projects: Project[];
  certifications: Certification[];
};

export type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  source: string;
  employmentType: string;
  remote: boolean;
  tags: string[];
};

export type JobRequirements = {
  title: string;
  company: string;
  location: string;
  experienceRequirements: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  educationRequirements: string[];
  responsibilities: string[];
};

/** A requirement the candidate fully satisfies, plus the resume text that proves it. */
export type MatchEvidence = {
  requirement: string;
  evidence: string[];
};

/** A requirement the candidate only partly demonstrates. */
export type PartialMatch = {
  requirement: string;
  evidence: string[];
  reason: string;
};

export type RelevantExperience = {
  title: string;
  company: string;
  why: string;
};

export type RelevantProject = {
  name: string;
  why: string;
};

/**
 * `reword` suggestions must point at something already in the resume
 * (`evidenceRef`), so the model can never suggest inventing experience.
 * `missing` items are generated deterministically from the unmatched requirement list.
 */
export type ResumeSuggestion = {
  kind: "reword" | "missing";
  text: string;
  evidenceRef: string;
  requirement: string;
};

export type MatchAnalysis = {
  job: Job;
  requirements: JobRequirements;
  fitScore: number;
  matches: MatchEvidence[];
  partialMatches: PartialMatch[];
  missingRequirements: string[];
  missingPreferred: string[];
  relevantExperience: RelevantExperience[];
  relevantProjects: RelevantProject[];
  summary: string;
  resumeSuggestions: ResumeSuggestion[];
  meta: {
    provider: string;
    model: string;
    promptVersion: string;
    ungroundedSuggestionsDropped: number;
  };
};

export type AiStatus = {
  provider: string;
  model: string;
  baseUrl: string;
  configured: boolean;
  reachable: boolean | null;
  error: string | null;
};

export type CandidateResponse = {
  candidate: Candidate;
  meta: {
    provider: string;
    model: string;
    promptVersion: string;
    characters: number;
    elapsedMs: number;
  };
};

export type JobsResponse = {
  jobs: Job[];
  warnings: string[];
  meta: {
    providers: string[];
    elapsedMs: number;
  };
};