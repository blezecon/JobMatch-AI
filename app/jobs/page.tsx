import { Suspense } from "react";
import { JobSearch } from "@/components/JobSearch";
import { LoadingState } from "@/components/Feedback";

export const metadata = { title: "Job search — JobMatch AI" };

export default function JobsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Find real jobs</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Results come straight from free public job APIs. Applying always happens on the original
          listing.
        </p>
      </div>
      <Suspense fallback={<LoadingState label="Loading search…" />}>
        <JobSearch />
      </Suspense>
    </div>
  );
}