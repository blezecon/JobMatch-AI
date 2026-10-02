"use client";

import { useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Heading } from "@/components/Feedback";
import { saveCandidate } from "@/lib/store";
import type { CandidateResponse } from "@/types";

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
    <Card>
      <CardHeader>
        <Heading>Upload your resume</Heading>
        <CardDescription>
          PDF only. Parsed in memory, never written to disk.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <Field>
            <FieldLabel htmlFor="resume-file">Resume PDF</FieldLabel>
            <Input id="resume-file" ref={inputRef} type="file" accept="application/pdf,.pdf" />
          </Field>
          {fileName ? <p className="text-sm">Selected: {fileName}</p> : null}
          {state.status === "uploading" ? (
            <Alert>
              <AlertTitle>Working on it</AlertTitle>
              <AlertDescription>
                Extracting text and running candidate extraction. Local models can take a minute.
              </AlertDescription>
            </Alert>
          ) : null}
          {state.status === "done" ? (
            <Alert>
              <AlertTitle>Profile extracted</AlertTitle>
              <AlertDescription>
                <span aria-hidden>✓</span> Your candidate profile is ready below.
              </AlertDescription>
            </Alert>
          ) : null}
          {state.status === "error" ? (
            <Alert variant="destructive" role="alert">
              <AlertTitle>Resume not processed</AlertTitle>
              <AlertDescription>
                <p>{state.message}</p>
                {state.hint ? <p className="opacity-80">{state.hint}</p> : null}
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={state.status === "uploading"}>
            {state.status === "uploading" ? "Reading resume…" : "Analyse resume"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}