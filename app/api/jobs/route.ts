import { ApiError, errorResponse } from "@/lib/http";
import { PROVIDERS, searchJobs, type WorkModeFilter } from "@/lib/jobs";
import type { JobsResponse } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODES: WorkModeFilter[] = ["any", "remote", "hybrid", "onsite"];

export async function GET(request: Request) {
  const startedAt = Date.now();
  try {
    const params = new URL(request.url).searchParams;
    const query = (params.get("role") ?? params.get("query") ?? "").trim();
    const location = (params.get("location") ?? "").trim();
    const requestedMode = (params.get("mode") ?? "any").toLowerCase() as WorkModeFilter;

    if (query.length < 2) {
      throw new ApiError("Enter a role or a few keywords to search for.", 400);
    }
    if (query.length > 120) {
      throw new ApiError("That search term is too long.", 400);
    }
    const mode = MODES.includes(requestedMode) ? requestedMode : "any";

    const { jobs, warnings } = await searchJobs({ query, location, mode });

    const body: JobsResponse = {
      jobs,
      warnings,
      meta: { providers: PROVIDERS.map((p) => p.label), elapsedMs: Date.now() - startedAt },
    };
    return Response.json(body);
  } catch (error) {
    return errorResponse(error);
  }
}