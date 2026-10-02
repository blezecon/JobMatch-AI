import { extractCandidate, PROMPT_VERSION } from "@/lib/ai";
import { requireAiConfig } from "@/lib/env";
import { errorResponse } from "@/lib/http";
import { extractPdfText } from "@/lib/resume";
import { readResumeUpload } from "@/lib/validation";
import type { CandidateResponse } from "@/types";

// PDF parsing and model inference both need Node APIs and real CPU time.
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const form = await request.formData();
    const buffer = await readResumeUpload(form);
    const resumeText = await extractPdfText(buffer);
    const candidate = await extractCandidate(resumeText);
    const { provider, model } = requireAiConfig();

    const body: CandidateResponse = {
      candidate,
      meta: {
        provider,
        model,
        promptVersion: PROMPT_VERSION,
        characters: resumeText.length,
        elapsedMs: Date.now() - startedAt,
      },
    };
    return Response.json(body);
  } catch (error) {
    return errorResponse(error);
  }
}