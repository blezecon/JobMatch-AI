"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { CandidateProfile } from "@/components/CandidateProfile";
import { EmptyState, Heading } from "@/components/Feedback";
import { ResumeUpload } from "@/components/ResumeUpload";
import { useCandidate } from "@/lib/store";

export default function ResumePage() {
  const candidate = useCandidate();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">Your resume</h1>
        <p className="mt-1">
          The extracted profile stays in this browser tab. Uploading a new PDF replaces it.
        </p>
      </div>

      <ResumeUpload />

      {candidate ? (
        <Card>
          <CardHeader>
            <Heading>Candidate profile</Heading>
            <CardDescription>Extracted by the open-weight model.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <CandidateProfile candidate={candidate} />
            <Link href="/jobs" className={buttonVariants()}>
              Search jobs for this profile
            </Link>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="No profile yet"
          message="Upload a PDF resume above and the extracted candidate profile will appear here."
        />
      )}
    </div>
  );
}