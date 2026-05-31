import type React from "react";

import { Card } from "~/components/ui/card";

export function DetailGrid({ items }: { items: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted-foreground)]">{item.label}</p>
          <div className="mt-2 break-words text-sm font-semibold leading-6 text-[var(--color-card-foreground)]">{item.value ?? "—"}</div>
        </div>
      ))}
    </div>
  );
}

export function JsonCard({ title, value }: { title: string; value: unknown }) {
  return (
    <Card>
      <h2 className="font-[var(--font-display)] text-2xl font-bold tracking-[-0.02em] text-[var(--color-card-foreground)]">{title}</h2>
      <pre className="mt-4 max-h-96 overflow-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4 text-xs leading-5 text-[var(--color-muted-foreground)]">
        {JSON.stringify(value, null, 2)}
      </pre>
    </Card>
  );
}
