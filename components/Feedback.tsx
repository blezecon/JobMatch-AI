/** One shared error/loading vocabulary, so every page fails the same way. */

export function LoadingState({ label, detail }: { label: string; detail?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-12 text-center dark:border-slate-800 dark:bg-slate-900"
    >
      <span
        aria-hidden
        className="size-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900 dark:border-slate-700 dark:border-t-white"
      />
      <p className="font-medium">{label}</p>
      {detail ? <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">{detail}</p> : null}
    </div>
  );
}

export function ErrorState({
  title,
  message,
  hint,
  action,
}: {
  title: string;
  message: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-300 bg-red-50 px-5 py-4 dark:border-red-900 dark:bg-red-950/40"
    >
      <p className="flex items-center gap-2 font-medium text-red-900 dark:text-red-100">
        <span aria-hidden>⚠</span>
        {title}
      </p>
      <p className="mt-1 text-sm text-red-800 dark:text-red-200">{message}</p>
      {hint ? <p className="mt-1 text-sm text-red-700/80 dark:text-red-300/80">{hint}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700">
      <p className="font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{message}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="font-semibold tracking-tight">{title}</h2>
      {description ? (
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function PrimaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
