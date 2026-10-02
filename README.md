# JobMatch AI

Understand which jobs actually fit your resume.

Built for the **Hacktoberfest 2026 Weekend Challenge: Build for a Friend** — an MVP that helps one
real person compare their resume against real job listings, with an open-weight model doing the
reading.

---

## Problem

Applying to jobs feels like guessing. You send a resume, hear nothing back, and never learn whether you
were rejected for a skill you lacked or because the recruiter moved on. Job descriptions are walls of
text. Your resume is a different wall of text. Nothing in either tells you where they line up.

Generic AI resume tools paper over this with a single invented score — "72% match" — and then suggest
you add experience you do not have.

## Solution

JobMatch AI reads both documents with an open-weight model, puts them in the same structured
vocabulary, and then compares them with plain code:

- **Matches** — requirements your resume already satisfies
- **Partial matches** — related, but not the same thing
- **Missing** — not evidenced anywhere in your resume
- **Relevant experience and projects** — the parts worth pointing at
- **Resume suggestions** — how to present what you already did, and an explicit note when something is
  genuinely absent

Every suggestion is grounded in your own resume text, or it is thrown away.

## Features

- PDF resume upload, parsed in memory
- Structured candidate profile extracted by an open-weight model (name, summary, skills, education,
  experience, projects, certifications)
- Real job search across four free public APIs at once
- Deterministic skill matching with alias normalization
- Grounded AI explanation: why you match, what is relevant, what to fix
- Honest missing-requirement reporting, and never an invented qualification
- Apply links straight to the original listing
- Loading, empty and error states on every step; keyboard accessible; mobile responsive

## Architecture

```text
                     Browser
                        │
                 ┌──────▼──────┐
                 │   Next.js   │  sessionStorage holds the candidate
                 │   Frontend  │  + the selected job. No database.
                 └──────┬──────┘
                        │  POST /api/resume   GET /api/jobs   POST /api/analyze
                 ┌──────▼──────┐
                 │ Next.js API │  Route Handlers (Node runtime)
                 │   Routes    │
                 └──────┬──────┘
         ┌────────────────┼──────────────────┐
         ▼                ▼                  ▼
  ┌─────────────┐  ┌─────────────┐   ┌─────────────┐
  │ Job search  │  │ PDF Parser  │   │ Open-weight │
  │ APIs (4)    │  │  (unpdf)    │   │    LLM      │  /chat/completions
  └─────────────┘  └─────────────┘   └──────┬──────┘
                                             ▼
                                      ┌─────────────┐
                                      │  Matching   │  deterministic, no model
                                      │   Engine    │
                                      └──────┬──────┘
                                             ▼
                                      ┌─────────────┐
                                      │ Match Report│  model explains the result
                                      └─────────────┘
```

The five stages, in order:

| Stage | Input | Output | Who does it |
| --- | --- | --- | --- |
| 1. Extract | PDF | plain text | `unpdf`, in memory |
| 2. Candidate | resume text | `Candidate` JSON | open-weight model |
| 3. Requirements | job description | `JobRequirements` JSON | open-weight model |
| 4. Match | candidate + requirements | matches / partials / missing | **plain code** |
| 5. Explain | candidate + stage 4 result | summary, suggestions | open-weight model |

Stage 4 deliberately has no model in it. The same resume and the same job always produce the same
report, and the model cannot talk itself into a better score.

## How AI is Used

`lib/ai.ts` is the only file that knows a model exists. It exposes three functions —
`extractCandidate`, `extractJobRequirements`, `explainMatch` — and one shared `askJson` helper that:

1. requests JSON mode (`response_format: { type: "json_object" }`),
2. parses the reply,
3. retries **once** with an explicit correction if the model returned prose or broken JSON,
4. validates the result with a zod schema before any code touches it.

### Resume integrity

This is the part that matters most, so it is enforced in code rather than asked for politely in the
prompt:

- The prompt forbids adding experience, skills, degrees or projects.
- Every explanation item must reuse a requirement string that stage 4 already computed. A model that
  invents a new requirement has its item dropped.
- `relevantExperience` and `relevantProjects` must match a real resume entry by exact title/company or
  project name. Invented entries are dropped.
- **Every resume suggestion must quote a phrase that appears in your resume** (`evidenceRef`). If the
  phrase is not there, the suggestion is discarded and counted in
  `meta.ungroundedSuggestionsDropped`, which the UI shows.
- "Missing" items are generated by the deterministic engine, not by the model, so they cannot be
  fabricated either.
- **Stage 3 output is filtered against the listing.** A skill the description never mentions, or that is
  an abstract noun (`accessibility`, `performance`), is dropped before matching. Otherwise a model
  hallucination becomes a "missing requirement" the candidate is told to fix, or zeroes the fit score.

So the model can reword, reorder and connect what you wrote. It cannot make anything up.

## Why Open-Source AI

An open-weight model is not a checkbox here — it is what makes the product possible and trustworthy:

- **It is the parser.** Turning a messy resume and a messy job description into one comparable
  vocabulary is a language task. Rule-based extraction breaks on every new CV layout; regex over job
  postings misses the requirement buried in a bullet. A small open-weight LLM handles both without
  hand-written heuristics.
- **It runs on your machine.** With Ollama or llama.cpp, the resume is parsed and analysed without ever
  leaving the laptop. For a document as personal as a resume, that is not a nice-to-have — it is the
  whole privacy story, and a closed API would end it at someone else's server.
- **It is auditable.** The prompts are versioned in source (`PROMPT_VERSION`), the matching is plain
  arithmetic you can read, and you can swap the model or the runtime without touching app code.
- **It is honest about cost.** A 4B model on a laptop is free to run and slow enough to be boring,
  which is a good trade for a tool you run on your own data.

**Verified end to end** with `gemma3:4b` on Ollama (fully local, ~50 s to extract the profile,
~3 min per full analysis on CPU), `google/gemma-3-27b-it` on OpenRouter (~7 s to extract,
~12–40 s per analysis), and `phi4.gguf` on llama.cpp over the LAN (~4 s to extract,
~16 s per analysis). Gemma is the default everywhere it is available; on a Groq account
that does not host Gemma, the default falls back to `openai/gpt-oss-20b`.

No claim of "100% accuracy" is made here. Small models misread resumes and mis-extract requirements.
That is why stage 4 is code, why every output is validated, and why missing skills are stated plainly
rather than smoothed over.

## Tech Stack

- **Next.js 16** (App Router, Route Handlers) · **React 19** · **TypeScript** · **Tailwind CSS v4**
- **zod** — validates model output, provider payloads and client input
- **unpdf** — PDF text extraction, no temp files
- **vitest** — unit tests for the pure functions
- **Open-weight LLM** via any OpenAI-compatible `/chat/completions` endpoint: Ollama, llama.cpp, Groq, OpenRouter

No authentication, no database, no Redis, no queue, no vector store, no RAG, no agent framework, no
state-management library.

## Setup

```bash
git clone <your-fork-url> jobmatch-ai
cd jobmatch-ai
npm install
cp .env.example .env.local
```

Requires Node.js 20 or newer.

## Environment Variables

Job search needs **no configuration at all** — all four sources are free and key-less.

The only thing you must set is an AI backend.

| Variable | Required | Purpose |
| --- | --- | --- |
| `AI_PROVIDER` | yes | `ollama`, `llamacpp`, `groq` or `openrouter` |
| `GROQ_API_KEY` | for `groq` | API key, stays server-side |
| `OPENROUTER_API_KEY` | for `openrouter` | API key, stays server-side |
| `AI_BASE_URL` | no | Override the provider URL (any OpenAI-compatible server) |
| `AI_MODEL` | no | Override the default model |
| `OLLAMA_BASE_URL` | no | Default `http://localhost:11434/v1` |
| `OLLAMA_MODEL` | no | Default `gemma3:4b` |
| `LLAMACPP_BASE_URL` | no | Default `http://localhost:8080/v1` |
| `LLAMACPP_MODEL` | no | Ignored by `llama-server`; set it anyway for other servers |
| `GROQ_BASE_URL`, `OPENROUTER_BASE_URL` | no | Same override for the hosted providers |
| `AI_TIMEOUT_MS` | no | Default `180000`; local CPU inference is slow |
| `MAX_RESUME_BYTES` | no | Default 5 MB |
| `JOB_TIMEOUT_MS` | no | Default 12000 per job provider |

Keys are read only in Route Handlers and never reach the browser. `.env*` is git-ignored;
`.env.example` is committed.

## Running Locally

### Option A — Ollama, fully local (resume never leaves your machine)

```bash
# install Ollama, then:
ollama pull gemma3:4b
ollama serve
```

```bash
AI_PROVIDER=ollama   # this is the default
```

### Option B — OpenRouter (tested, recommended for a fast demo)

```bash
echo "AI_PROVIDER=openrouter" >> .env.local
echo "OPENROUTER_API_KEY=sk-or-..." >> .env.local
```

Default model: `google/gemma-3-27b-it`. Free tier works. A full analysis takes ~15–40 s.

### Option C — Groq

```bash
echo "AI_PROVIDER=groq" >> .env.local
echo "GROQ_API_KEY=gsk_..." >> .env.local
```

Default model: `openai/gpt-oss-20b`. Groq gates models per organization: if your key returns
`403 ... blocked at the organization level`, an admin must enable the model at
https://console.groq.com/settings/limits. The app reports this as
"The model … is not enabled for this groq account" rather than blaming your key.

### Option D — llama.cpp

```bash
llama-server -m phi4.gguf --host 0.0.0.0 --port 8080
```

```bash
AI_PROVIDER=llamacpp
LLAMACPP_BASE_URL=http://localhost:8080/v1
```

`llama-server` serves whichever GGUF it was started with and ignores the `model` field, so
`AI_MODEL` can be left unset. Point `LLAMACPP_BASE_URL` at your LAN address to use a model running on
another machine.

Then:

```bash
npm run dev
```

Open http://localhost:3000.

`npm run build && npm start` for a production build.

### Other commands

```bash
npm test         # unit tests, no network and no model required
npm run lint
npm run typecheck
npm run sample:resume   # regenerate scripts/resume.pdf (plain node, no dependencies)
```

## Job API

Four sources, queried in parallel with `Promise.allSettled` and merged into one `Job` shape
(`lib/jobs.ts` defines the interface; each adapter lives in `lib/providers/`):

| Provider | Base URL | Search | Notes |
| --- | --- | --- | --- |
| Arbeitnow | `https://www.arbeitnow.com/api/job-board-api` | client-side filter | Europe-leaning; `remote` flag; hybrid in tags |
| Jobicy | `https://jobicy.com/api/v2/remote-jobs` | `tag` param + filter | remote-first |
| RemoteOK | `https://remoteok.com/api` | client-side filter | remote-only, no query parameter |
| Remotive | `https://remotive.com/api/remote-jobs` | `search` param | remote-first |

Notes worth knowing before you demo:

- HTML descriptions are stripped to plain text before they reach the model.
- RemoteOK and Jobicy both require visible attribution: every card shows its source and links to the
  original listing.
- One provider being down degrades to a warning line, not a blank page. If all four fail you get a
  clear error — never invented jobs.
- Filtering is substring/token matching, so results are broad. Location coverage outside Europe is thin
  on Arbeitnow; the remote-first sources are global but rarely city-specific.

## Project Structure

```text
app/
├── layout.tsx                    nav, footer, privacy note
├── page.tsx                      landing
├── resume/page.tsx               upload + candidate profile
├── jobs/page.tsx                 search + job cards
├── analyze/[jobId]/page.tsx      match report
└── api/
    ├── resume/route.ts           POST multipart PDF → Candidate
    ├── jobs/route.ts             GET ?role=&location=&mode= → Job[]
    ├── analyze/route.ts          POST { candidate, job } → MatchAnalysis
    └── status/route.ts           which AI backend is live

components/    SiteChrome Badges Feedback CandidateProfile ResumeUpload
               JobSearch MatchReport
lib/
├── ai.ts                        the only file that knows about models
├── schema.ts                    zod schemas for model + client input
├── env.ts                       backend config, limits
├── http.ts                      ApiError, timeout fetch, safe error responses
├── resume.ts                    PDF → text
├── matching.ts                  stage 4: normalize, match, score, shortlist
├── jobs.ts                      provider registry + fan-out
├── job-utils.ts                 stripHtml, filters, dedupe
├── providers/                   arbeitnow · jobicy · remoteok · remotive
├── store.ts                     sessionStorage helpers
└── validation.ts                upload + analyze body guards

test/       matching · jobs · ai · pdf      (76 tests, no network or model needed)
types/      all shared types
scripts/    make-sample-resume.mjs + the sample resume.pdf the PDF tests use
```

## Privacy

- **No database.** No account, no server-side storage, no persistence of resumes.
- **No temp files.** The PDF is read into memory, parsed, and dropped. There is nothing on disk to clean up.
- **Nothing logged.** Resume text, job prompts and model replies are never written to logs. Failures log
  the exception, not the payload.
- **Local by choice.** On Ollama or llama.cpp the resume never leaves your machine.
- **Client-side session only.** The candidate profile and the job list live in `sessionStorage` and
  disappear when the tab closes.
- **Cloud caveat.** On Groq or OpenRouter, resume text is sent to that provider's API for inference.
  Use the local backends if that matters.
- Model replies can echo resume content, so a malformed-output error is never surfaced verbatim to the
  browser.

## Limitations

- **No database, by design.** Job text lives in one tab, so `/analyze/<id>` fails in a new tab. That is
  the cost of storing nothing, and it is a deliberate trade for an MVP.
- **Small-model extraction is imperfect.** Gemma on CPU is slow (tens of seconds per stage) and will
  occasionally misread a resume. Stage 4 being code is what keeps a bad extraction from becoming a fake
  score.
- **Substring matching is coarse.** Skill comparison is token-based and deliberately conservative, so it
  will mark some real experience as partial and can miss synonyms outside the alias table.
- **Skill filtering is a stop-word list, not a taxonomy.** Nouns a model mistakes for skills
  (`accessibility`, `performance`, `problem solving`) are dropped so they cannot zero out a fit score,
  but the list is small. A posting whose "required skills" are genuinely abstract nouns will score 0.
- **A listing with 20-plus preferred skills gives a low percentage.** The score is raw coverage, so
  matching 1 of 23 nice-to-haves reads as 4% even when the stack fits. The absolute number means less
  than the lists next to it.
- **Resume text is truncated** at 14,000 characters before prompting, to bound inference cost.
- **Job coverage skews remote and European.** All four sources are free and key-less; none has strong
  India/Kolkata city-level coverage.
- **Attribution obligations.** RemoteOK and Jobicy require source credit, which the UI provides.
- **Not an application tool.** It never applies to anything, and never autofills a form.

## Future Improvements

- Persist the candidate profile in IndexedDB so the analysis link survives a reload (still no server)
- Skill taxonomy with a real ontology, replacing the alias table
- Weighted scoring: project depth and recency, not just skill presence
- Cover-letter draft from grounded resume content only
- Provider-specific pagination for better result volume
- Batch analysis: rank a saved list of jobs by fit

## Hacktoberfest 2026

Built for the Weekend Challenge: Build for a Friend.

Why this project leans on open-source AI: the honest version of "which jobs fit my resume" needs
something that can read two unstructured documents and put them in the same vocabulary, and it needs to
do that on a machine the user controls. That is exactly what an open-weight model gives you. Everything
else here — the deterministic matching, the grounding rules, the privacy posture — exists to make that
model's output trustworthy rather than impressive.

Try it, and open issues: better skill aliases, a provider that covers your region, real CV layouts the
extractor mishandles.

```bash
npm install
cp .env.example .env.local   # set AI_PROVIDER and a key, or run Ollama locally
npm run dev
```

## License

MIT.# JobMatch-AI
# JobMatch-AI
# JobMatch-AI
