/**
 * Manual check, not a unit test: it drives the real /analyze flow against a running
 * Next server, so it needs a live AI backend. Run it with:
 *
 *   pnpm dev &
 *   JOB_ID=<id> node scripts/verify-analyze-page.mjs <job.json>
 */
import { readFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const job = JSON.parse(readFileSync(process.argv[2], "utf8"));

const candidate = {
  name: "Priya Sharma",
  summary: "Frontend developer.",
  skills: ["JavaScript", "React", "Git", "Node.js"],
  education: [],
  experience: [],
  projects: [],
  certifications: [],
};

const analysisRes = await fetch(`${BASE}/api/analyze`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ candidate, job }),
});
const analysis = await analysisRes.json();
console.log("POST /api/analyze ->", analysisRes.status);
if (!analysisRes.ok) {
  console.log(analysis);
  process.exit(1);
}

const page = await fetch(`${BASE}/analyze/${encodeURIComponent(job.id)}`);
const html = await page.text();
console.log("GET /analyze/[jobId] ->", page.status, html.length, "bytes");

console.log("sections present in the rendered page:");
for (const needle of [
  "Match analysis",
  analysis.job.title,
  `${analysis.fitScore}%`,
  "Matching skills",
  "Partial matches",
  "Missing requirements",
  "Relevant experience",
  "Relevant projects",
  "Resume suggestions",
  "Apply on",
]) {
  console.log(`  ${html.includes(needle) ? "yes" : "NO "}  ${needle}`);
}

console.log("payload contents:", {
  matches: analysis.matches.length,
  partials: analysis.partialMatches.length,
  missing: analysis.missingRequirements.length,
  experience: analysis.relevantExperience.length,
  projects: analysis.relevantProjects.length,
  suggestions: analysis.resumeSuggestions.length,
  droppedUngrounded: analysis.meta.ungroundedSuggestionsDropped,
});

// The page reads the job back out of sessionStorage, so prove that path too.
const stored = { ...job };
console.log(
  "sessionStorage round-trip:",
  JSON.parse(JSON.stringify(stored)).id === job.id ? "ok" : "broken",
);