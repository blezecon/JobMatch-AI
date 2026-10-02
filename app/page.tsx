"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AiStatusBadge } from "@/components/Badges";
import { PrimaryButton } from "@/components/Feedback";
import type { AiStatus } from "@/types";

const STEPS = [
  {
    title: "Upload your resume",
    body: "A PDF is parsed in memory. The text never touches a database and the file is discarded when the request ends.",
  },
  {
    title: "Extract a candidate profile",
    body: "An open-weight model turns the raw text into skills, experience, projects and education as structured JSON.",
  },
  {
    title: "Search real job listings",
    body: "Four free, key-less public job APIs are queried in parallel and merged into one list.",
  },
  {
    title: "Compare and get it straight",
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
    <div className="space-y-16">
      <section className="pt-8 text-center">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1 text-xs dark:border-slate-700">
          <span aria-hidden>◆</span> Hacktoberfest 2026 · Build for a Friend
        </p>
        <h1 className="mx-auto max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Understand which jobs actually fit your resume.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-600 dark:text-slate-300">
          JobMatch AI reads your resume, searches real listings, and tells you plainly what you match,
          what you only half-match, and what is missing. No black-box score, no invented experience.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/resume">
            <PrimaryButton type="button">Upload resume</PrimaryButton>
          </Link>
          <Link
            href="/jobs"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Browse jobs first
          </Link>
        </div>
        <p className="mt-6 flex justify-center">
          <AiStatusBadge status={status} />
        </p>
      </section>

      <section aria-labelledby="how-heading">
        <h2 id="how-heading" className="text-2xl font-semibold tracking-tight">
          How it works
        </h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <span className="grid size-7 place-items-center rounded-full bg-slate-900 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">
                {index + 1}
              </span>
              <h3 className="mt-3 font-medium">{step.title}</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="ai-heading"
        className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 id="ai-heading" className="text-2xl font-semibold tracking-tight">
          Open-source AI is the engine here
        </h2>
        <div className="mt-4 space-y-4 text-slate-600 dark:text-slate-300">
          <p>
            The interesting part of this problem is turning messy resume text and messy job descriptions
            into the same structured vocabulary. That is what the open-weight model does: it extracts a
            candidate profile and a requirements list as validated JSON.
          </p>
          <p>
            It runs on <strong>Gemma</strong>, an open-weight model. Point the app at Ollama or a
            llama.cpp server and inference happens on your own machine, so the resume never leaves it.
            Point it at a hosted open-weight provider instead and the same code works unchanged.
          </p>
          <p>
            The match score itself is not generated. Skill comparison is plain code, so the same resume
            and the same job always produce the same report. The model explains the result and is
            required to cite the resume text it used — anything it cannot ground is discarded.
          </p>
        </div>
      </section>
    </div>
  );
}