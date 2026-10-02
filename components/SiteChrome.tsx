import Link from "next/link";

const NAV = [
  { href: "/resume", label: "Resume" },
  { href: "/jobs", label: "Jobs" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span
            aria-hidden
            className="grid size-7 place-items-center rounded-md bg-slate-900 text-xs font-bold text-white dark:bg-white dark:text-slate-900"
          >
            JM
          </span>
          <span>JobMatch AI</span>
        </Link>
        <nav aria-label="Main">
          <ul className="flex items-center gap-1 text-sm">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-md px-3 py-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                >
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
    <footer className="mt-auto border-t border-slate-200 py-8 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
      <div className="mx-auto w-full max-w-5xl space-y-1 px-4">
        <p>
          Your resume is processed in memory for this request only. Nothing is stored on a server, and with
          a local model it never leaves your machine.
        </p>
        <p>Open-weight model inference. Job listings come from public, key-free job APIs.</p>
      </div>
    </footer>
  );
}