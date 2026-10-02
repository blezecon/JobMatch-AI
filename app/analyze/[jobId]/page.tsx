import { MatchReport } from "@/components/MatchReport";

export const metadata = { title: "Match analysis — JobMatch AI" };

export default async function AnalyzePage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Match analysis</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Skill matching is computed in code. The model only explains your own resume.
        </p>
      </div>
      <MatchReport jobId={decodeURIComponent(jobId)} />
    </div>
  );
}