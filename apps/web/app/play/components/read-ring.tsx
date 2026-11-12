import type { ReadIndicator } from "../read-ring.ts";

const SEGMENTS = 8;

/** The quiet ring and Thinking (spec 066 FR-024, FR-025): words, with `role="status"`. */
export function ReadRing({ indicator }: { indicator: ReadIndicator }) {
  if (indicator.kind === "hidden") return null;
  if (indicator.kind === "thinking") {
    return (
      <p
        role="status"
        className="border-t border-border bg-muted px-3 py-1 text-sm text-muted-foreground"
      >
        The DM is reading the table…
      </p>
    );
  }
  return (
    <div
      role="status"
      className="flex items-center gap-2 border-t border-border bg-muted px-3 py-1 text-sm text-muted-foreground"
    >
      <span aria-hidden="true" className="flex gap-0.5">
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed 8 segments
            key={i}
            data-filled={i < indicator.segments}
            className={`h-2 w-3 rounded-sm ${i < indicator.segments ? "bg-primary" : "bg-border"}`}
          />
        ))}
      </span>
      The DM reads the table in {indicator.remainingS} s. Keep talking to wait.
    </div>
  );
}
