"use client";

import Link from "next/link";
import { CandidateProfile } from "@/components/CandidateProfile";
import { EmptyState, PrimaryButton, SectionCard } from "@/components/Feedback";
import { ResumeUpload } from "@/components/ResumeUpload";
import { useCandidate } from "@/lib/store";

export default function ResumePage() {
  const candidate = useCandidate();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your resume</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          The extracted profile stays in this browser tab. Uploading a new PDF replaces it.
        </p>
      </div>

      <ResumeUpload />

      {candidate ? (
        <SectionCard title="Candidate profile" description="Extracted by the open-weight model.">
          <CandidateProfile candidate={candidate} />
          <div className="mt-6">
            <Link href="/jobs">
              <PrimaryButton type="button">Search jobs for this profile</PrimaryButton>
            </Link>
          </div>
        </SectionCard>
      ) : (
        <EmptyState
          title="No profile yet"
          message="Upload a PDF resume above and the extracted candidate profile will appear here."
        />
      )}
    </div>
  );
}