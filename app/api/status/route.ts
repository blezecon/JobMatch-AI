import { probeAi } from "@/lib/ai";
import { AI_BACKENDS, describeAi } from "@/lib/env";
import { PROVIDERS } from "@/lib/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const providerLabels = () => PROVIDERS.map((provider) => provider.label);

export async function GET(request: Request) {
  const status = describeAi();
  // The probe costs a model call, so it is opt-in: /api/status?probe=1
  const probe = new URL(request.url).searchParams.has("probe") ? await probeAi() : null;
  return Response.json({
    ai: probe ? { ...status, ...probe } : status,
    providers: providerLabels(),
    backends: AI_BACKENDS,
  });
}