import type { InputHTMLAttributes } from "react";

import { cn } from "~/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--primary))]",
        className,
      )}
      {...props}
    />
  );
}
