"use client";

import { useRef, useState } from "react";
import { saveCandidate } from "@/lib/store";
import type { CandidateResponse } from "@/types";
import { ErrorState, PrimaryButton, SectionCard } from "./Feedback";

type ErrorBody = { error?: string; hint?: string };

type UploadState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "done" }
  | { status: "error"; message: string; hint?: string };

export function ResumeUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const [fileName, setFileName] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setState({ status: "error", message: "Choose a PDF resume first." });
      return;
    }
    setFileName(file.name);
    setState({ status: "uploading" });

    const body = new FormData();
    body.append("file", file);
    try {
      const response = await fetch("/api/resume", { method: "POST", body });
      const payload = (await response.json()) as CandidateResponse | ErrorBody;
      if (!response.ok) {
        const failure = payload as ErrorBody;
        setState({
          status: "error",
          message: failure.error ?? "We could not read that resume.",
          ...(failure.hint ? { hint: failure.hint } : {}),
        });
        return;
      }
      saveCandidate((payload as CandidateResponse).candidate);
      setState({ status: "done" });
    } catch {
      setState({
        status: "error",
        message: "The upload failed before it reached the server.",
        hint: "Check your connection and try again.",
      });
    }
  }

  return (
    <SectionCard
      title="Upload your resume"
      description="PDF only. Parsed in memory, never written to disk."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label htmlFor="resume-file" className="text-sm font-medium">
            Resume PDF
          </label>
          <input
            id="resume-file"
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700 dark:file:bg-white dark:file:text-slate-900 dark:file:hover:bg-slate-200"
          />
        </div>
        <PrimaryButton type="submit" disabled={state.status === "uploading"}>
          {state.status === "uploading" ? "Reading resume…" : "Analyse resume"}
        </PrimaryButton>
        {fileName ? <p className="text-xs text-slate-500">Selected: {fileName}</p> : null}
      </form>

      {state.status === "uploading" ? (
        <p role="status" aria-live="polite" className="mt-4 text-sm text-slate-600 dark:text-slate-300">
          Extracting text and running candidate extraction. Local models can take a minute.
        </p>
      ) : null}

      {state.status === "done" ? (
        <p role="status" className="mt-4 text-sm text-emerald-700 dark:text-emerald-300">
          <span aria-hidden>✓</span> Profile extracted.
        </p>
      ) : null}

      {state.status === "error" ? (
        <div className="mt-4">
          <ErrorState title="Resume not processed" message={state.message} hint={state.hint} />
        </div>
      ) : null}
    </SectionCard>
  );
}