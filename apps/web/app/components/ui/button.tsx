import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "ghost" | "outline";

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-clay bg-clay text-cream shadow-warm hover:bg-clay-dark hover:border-clay-dark",
  ghost: "border-transparent bg-transparent text-muted hover:bg-card-muted hover:text-foreground",
  outline: "border-border bg-card text-foreground hover:border-clay hover:bg-card-muted hover:text-clay-dark",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "button-base disabled:pointer-events-none",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
