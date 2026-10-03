"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AiStatusBadge } from "@/components/Badges";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Heading } from "@/components/Feedback";
import {
  Cpu,
  ListChecks,
  ShieldCheck,
  Upload,
  Search,
} from "lucide-react";
import type { AiStatus } from "@/types";

const STEPS = [
  {
    title: "Upload your resume",
    icon: Upload,
    body: "A PDF is parsed in memory. The text never touches a database and the file is discarded when the request ends.",
  },
  {
    title: "Extract a candidate profile",
    icon: Cpu,
    body: "An open-weight model turns the raw text into skills, experience, projects and education as structured JSON.",
  },
  {
    title: "Search real job listings",
    icon: ListChecks,
    body: "Six free, key-less public job APIs are queried in parallel and merged into one list.",
  },
  {
    title: "Compare and get it straight",
    icon: ShieldCheck,
    body: "Matching is deterministic arithmetic over your skills. The model only explains what is already there — it never invents experience.",
  },
];

export default function LandingPage() {
  const [status, setStatus] = useState<AiStatus | null>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((response) => response.json())
      .then((payload: { ai: AiStatus }) => setStatus(payload.ai))
      .catch(() => setStatus(null));
  }, []);

  return (
    <div className="space-y-12">
      <section className="pt-6 text-center">
        <p className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide">
        Hacktoberfest 2026
        </p>
        <h1 className="mx-auto max-w-3xl font-heading text-4xl font-bold sm:text-6xl">
          Understand which jobs actually fit your resume.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg">
          DevOrbit reads your resume, searches real listings, and tells you
          plainly what you match, what you only half-match, and what is missing.
          No black-box score, no invented experience.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/resume" className={buttonVariants({ size: "lg" })}>
            <Upload aria-hidden />
            Upload resume
          </Link>
          <Link
            href="/jobs"
            className={buttonVariants({ size: "lg", variant: "neutral" })}
          >
            <Search aria-hidden />
            Browse jobs first
          </Link>
        </div>
        <p className="mt-6 flex justify-center">
          <AiStatusBadge status={status} />
        </p>
      </section>

      <section aria-labelledby="how-heading" className="space-y-4">
        <h2 id="how-heading" className="font-heading text-3xl font-bold">
          How it works
        </h2>
        <ol className="grid gap-4 sm:grid-cols-2">
          {STEPS.map(({ title, icon: Icon, body }) => (
            <li key={title}>
              <Card className="h-full">
                <CardHeader>
                  <Heading className="flex items-center gap-2 text-lg">
                    <span className="inline-grid size-7 place-items-center rounded-base border-2 border-border bg-main">
                      <Icon aria-hidden className="size-4" />
                    </span>
                    {title}
                  </Heading>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{body}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <Card className="border-4">
        <CardHeader>
          <Heading>Open-source AI is the engine here</Heading>
          <CardDescription>
            The interesting part of this problem is turning messy resume text
            and messy job descriptions into the same structured vocabulary. That
            is what the open-weight model does.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            It runs on <strong>Gemma</strong>, an open-weight model. Point the
            app at Ollama or a llama.cpp server and inference happens on your
            own machine, so the resume never leaves it. Point it at a hosted
            open-weight provider instead and the same code works unchanged.
          </p>
          <p>
            The match score itself is not generated. Skill comparison is plain
            code, so the same resume and the same job always produce the same
            report. The model explains the result and is required to cite the
            resume text it used — anything it cannot ground is discarded.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
