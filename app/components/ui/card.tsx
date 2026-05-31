import * as React from "react";

import { cn } from "~/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-[var(--shadow-panel)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex items-center gap-3", className)} {...props} />
  );
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn(
        "font-[var(--font-display)] text-2xl font-bold tracking-[-0.02em] text-[var(--color-card-foreground)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p className={cn("mt-4 leading-7 text-[var(--color-muted-foreground)]", className)} {...props} />
  );
}
