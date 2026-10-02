import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

const NAV = [
  { href: "/resume", label: "Resume" },
  { href: "/jobs", label: "Jobs" },
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
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={buttonVariants({ variant: "neutral", size: "sm" })}>
                  {item.label}
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
      <div className="mx-auto w-full max-w-5xl space-y-1 px-4 py-6 text-sm">
        <Badge variant="neutral" className="border-2 border-border">
          Privacy
        </Badge>
        <p>
          Your resume is processed in memory for this request only. Nothing is stored on a server, and
          with a local model it never leaves your machine.
        </p>
        <p>Open-weight model inference. Job listings come from public, key-free job APIs.</p>
      </div>
    </footer>
  );
}