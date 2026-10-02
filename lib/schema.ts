import { z } from "zod";

/**
 * Tolerant field types for model output: small open-weight models often return
 * the wrong JSON type for one field. `.catch()` coerces that field, `.default()`
 * fills it in when absent. The object shape itself is still enforced, and unknown
 * keys are stripped — we never trust anything we did not ask for.
 */
const text = (fallback = "") => z.string().catch(fallback).default(fallback);

/**
 * Small models often answer a list field with a single bare string. Accept both
 * shapes rather than losing the whole list to a type error.
 */
const textList = () =>
  z
    .unknown()
    .catch([])
    .default([])
    .transform((value) => {
      const entries = Array.isArray(value) ? value : [value];
      return entries
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean);
    });

/**
 * Array of records where one malformed entry must not void the whole array.
 * Non-object entries are dropped before validation; field-level coercion is
 * handled by each record schema.
 */
const recordArray = <T extends z.ZodType>(item: T) =>
  z
    .array(z.unknown())
    .catch([])
    .default([])
    .transform((entries) =>
      entries
        .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
        .map((entry) => item.safeParse(entry))
        .filter((result) => result.success)
        .map((result) => result.data),
    );

const educationSchema = z
  .object({
    institution: text(),
    degree: text(),
    field: text(),
    year: text(),
  })
  .strip();

const experienceSchema = z
  .object({
    company: text(),
    title: text(),
    period: text(),
    highlights: textList(),
  })
  .strip();

const projectSchema = z
  .object({
    name: text(),
    description: text(),
    technologies: textList(),
    url: text(),
  })
  .strip();

const certificationSchema = z
  .object({
    name: text(),
    issuer: text(),
    year: text(),
  })
  .strip();

export const candidateSchema = z
  .object({
    name: text("Unknown"),
    summary: text(),
    skills: textList(),
    education: recordArray(educationSchema),
    experience: recordArray(experienceSchema),
    projects: recordArray(projectSchema),
    certifications: recordArray(certificationSchema),
  })
  .strip();

/** Stage 3 output. */
export const jobRequirementsSchema = z
  .object({
    title: text(),
    company: text(),
    location: text(),
    experienceRequirements: textList(),
    requiredSkills: textList(),
    preferredSkills: textList(),
    educationRequirements: textList(),
    responsibilities: textList(),
  })
  .strip();

const reasonSchema = z
  .object({ requirement: text(), why: text() })
  .strip();

/** Stage 5 output: explanation only, never new facts. */
export const matchExplanationSchema = z
  .object({
    summary: text(),
    matchReasons: recordArray(reasonSchema),
    partialReasons: recordArray(reasonSchema),
    relevantExperience: recordArray(z.object({ title: text(), company: text(), why: text() }).strip()),
    relevantProjects: recordArray(z.object({ name: text(), why: text() }).strip()),
    resumeSuggestions: recordArray(
      z.object({ kind: text("reword"), text: text(), evidenceRef: text() }).strip(),
    ),
  })
  .strip();

export type MatchExplanation = z.infer<typeof matchExplanationSchema>;

/**
 * The job object the client posts back to /api/analyze. Stricter than the model
 * schema: it comes from our own /api/jobs response, not from a language model.
 */
export const jobSchema = z
  .object({
    id: z.string().min(1),
    title: text(),
    company: text(),
    location: text(),
    description: z.string().catch("").default(""),
    url: z.string().catch("").default(""),
    source: text(),
    employmentType: text(),
    remote: z.boolean().catch(false).default(false),
    tags: textList(),
  })
  .strip();