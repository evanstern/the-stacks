import * as React from "react";

import { cn } from "~/lib/utils";

export function Badge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-secondary)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-secondary-foreground)]",
        className,
      )}
      {...props}
    />
  );
}
