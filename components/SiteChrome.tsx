import Link from "next/link";
import { Cpu, FileText, Search, ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PROVIDERS } from "@/lib/jobs";

const NAV = [
  { href: "/resume", label: "Resume", icon: FileText },
  { href: "/jobs", label: "Jobs", icon: Search },
];

export function SiteHeader() {
  return (
    <header className="border-b-2 border-border bg-background">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-heading text-lg font-bold">
          <span className="grid size-8 place-items-center rounded-base border-2 border-border bg-main text-sm font-bold shadow-shadow">
            JM
          </span>
          JobMatch AI
        </Link>
        <nav aria-label="Main">
          <ul className="flex items-center gap-2">
            {NAV.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link href={href} className={buttonVariants({ variant: "neutral", size: "sm" })}>
                  <Icon aria-hidden className="mr-1.5 inline size-4" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t-2 border-border bg-secondary-background">
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <p className="flex items-center gap-2 font-heading text-lg font-bold">
              <span
                aria-hidden
                className="grid size-7 place-items-center rounded-base border-2 border-border bg-main text-xs font-bold"
              >
                JM
              </span>
              JobMatch AI
            </p>
            <p className="text-sm">
              Understand which jobs actually fit your resume. Built for Hacktoberfest 2026 — Build
              for a Friend.
            </p>
          </div>

          <nav aria-label="Footer" className="space-y-2">
            <h2 className="font-heading font-bold">Pages</h2>
            <ul className="space-y-1 text-sm">
              <li>
                <Link href="/" className="underline underline-offset-2 hover:no-underline">
                  Home
                </Link>
              </li>
              {NAV.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="underline underline-offset-2 hover:no-underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* RemoteOK and Jobicy both require visible credit with a link, so this is
              generated from the live provider list rather than hand-copied. */}
          <section aria-labelledby="sources-heading" className="space-y-2">
            <h2 id="sources-heading" className="font-heading font-bold">
              Job data
            </h2>
            <p className="text-sm">
              Listings come from free public APIs, queried together. Each card links back to the
              original posting.
            </p>
            <ul className="flex flex-wrap gap-1.5 text-xs">
              {PROVIDERS.map((provider) => (
                <li key={provider.id}>
                  <a
                    href={provider.homepage}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-block rounded-base border-2 border-border px-2 py-0.5 transition-colors hover:bg-main"
                  >
                    {provider.label} ↗
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="mt-8 space-y-2 border-t-2 border-border pt-4 text-sm">
          <p className="flex items-start gap-2">
            <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              Your resume is processed in memory for that request only. Nothing is stored, there is no
              account, and with a local model the resume never leaves your machine.
            </span>
          </p>
          <p className="flex items-start gap-2">
            <Cpu aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              Structured extraction and explanation run on an open-weight model. Skill matching itself
              is plain code, so the same resume and job always give the same report.
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}