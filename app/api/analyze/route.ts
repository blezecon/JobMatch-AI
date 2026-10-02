import { explainMatch, extractJobRequirements, PROMPT_VERSION } from "@/lib/ai";
import { requireAiConfig } from "@/lib/env";
import { ApiError, errorResponse } from "@/lib/http";
import { matchCandidateToJob } from "@/lib/matching";
import type { MatchAnalysis } from "@/types";
import { parseAnalyzeBody } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const { candidate, job } = parseAnalyzeBody(await readJsonBody(request));

    if (!job.description.trim()) {
      throw new ApiError("That job listing has no description to compare against.", 400);
    }

    // Stage 3: requirements out of the listing.
    const requirements = await extractJobRequirements(job);
    // Stage 4: deterministic comparison. No model involved.
    const computed = matchCandidateToJob(candidate, requirements);
    // Stage 5: explanation, grounded in the resume text we already have.
    const explained = await explainMatch({
      candidate,
      analysis: { job, requirements, ...computed },
    });

    const analysis: MatchAnalysis = {
      job,
      requirements,
      ...computed,
      summary: explained.summary,
      matches: explained.matches,
      partialMatches: explained.partialMatches,
      relevantExperience: explained.relevantExperience,
      relevantProjects: explained.relevantProjects,
      resumeSuggestions: explained.resumeSuggestions,
      meta: {
        provider: requireAiConfig().provider,
        model: requireAiConfig().model,
        promptVersion: PROMPT_VERSION,
        ungroundedSuggestionsDropped: explained.dropped,
      },
    };
    return Response.json(analysis);
  } catch (error) {
    return errorResponse(error);
  }
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError("The request body was not valid JSON.", 400);
  }
}