import { z } from "zod";
import type { Candidate, Job } from "@/types";
import { LIMITS } from "./env";
import { ApiError } from "./http";
import { candidateSchema, jobSchema } from "./schema";

/** Trust boundary: everything below validates untrusted input. */

const PDF_MAGIC = "%PDF";

export async function readResumeUpload(form: FormData): Promise<ArrayBuffer> {
  const entry = form.get("file");
  if (!entry || typeof entry === "string") {
    throw new ApiError("No file was uploaded.", 400);
  }
  const file = entry;
  const looksLikePdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!looksLikePdf) {
    throw new ApiError("Only PDF resumes are supported.", 415, "Export your resume as a PDF and retry.");
  }
  if (file.size === 0) {
    throw new ApiError("That file is empty.", 422);
  }
  if (file.size > LIMITS.maxResumeBytes) {
    const limitMb = Math.round(LIMITS.maxResumeBytes / (1024 * 1024));
    throw new ApiError(
      `That file is larger than ${limitMb} MB.`,
      413,
      "Compress the PDF or remove embedded images.",
    );
  }

  const buffer = await file.arrayBuffer();
  const header = new TextDecoder("latin1").decode(buffer.slice(0, 4));
  if (header !== PDF_MAGIC) {
    throw new ApiError("That file is not a valid PDF.", 415);
  }
  return buffer;
}

const analyzeBodySchema = z
  .object({
    candidate: candidateSchema,
    job: jobSchema,
  })
  .strip();

export function parseAnalyzeBody(raw: unknown): { candidate: Candidate; job: Job } {
  let body: unknown;
  try {
    body = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw new ApiError("The request body was not valid JSON.", 400);
  }
  const result = analyzeBodySchema.safeParse(body);
  if (!result.success) {
    throw new ApiError(
      "The analysis request was incomplete.",
      400,
      "Upload your resume on the Resume page before analysing a job.",
    );
  }
  return result.data;
}