import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader,
} from "@/components/ui/card";
import {
  Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export { Button };

export function LoadingState({ label, detail }: { label: string; detail?: string }) {
  return (
    <Card role="status" aria-live="polite">
      <CardHeader>
        <Heading className="flex items-center gap-2">
          <Skeleton className="size-4 rounded-base" />
          {label}
        </Heading>
        {detail ? <CardDescription>{detail}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </CardContent>
    </Card>
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
    <Alert variant="destructive" role="alert">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        {hint ? <p className="opacity-80">{hint}</p> : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </AlertDescription>
    </Alert>
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
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
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
    <Card>
      <CardHeader>
        <Heading>{title}</Heading>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/**
 * CardTitle renders a div, so section titles need a real heading for screen
 * readers. Uses the library's own tokens rather than restyling by hand.
 */
export function Heading({
  level = 2,
  children,
  className,
}: {
  level?: 1 | 2 | 3 | 4;
  children: React.ReactNode;
  className?: string;
}) {
  const Tag = `h${level}` as const;
  return (
    <Tag className={cn("font-heading font-bold", level === 1 ? "text-4xl" : "text-xl", className)}>
      {children}
    </Tag>
  );
}