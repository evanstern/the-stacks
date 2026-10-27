import { useEffect, useRef, useState } from "react";
import type { JobView } from "../job-view.ts";
import { JobCard } from "./job-card.tsx";

/** Oldest job at the top; follows the bottom unless the operator scrolled up. */
export function JobTimeline({
  views,
  highlightedJobId,
  canLoadOlder,
  onLoadOlder,
  onSelectJob,
  onSelectSeq,
}: {
  views: readonly JobView[];
  highlightedJobId: string | null;
  canLoadOlder: boolean;
  onLoadOlder: () => void;
  onSelectJob: (id: string) => void;
  onSelectSeq: (seq: number) => void;
}) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const box = useRef<HTMLDivElement>(null);
  const follow = useRef(true);

  const count = views.length;
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when a job is added
  useEffect(() => {
    const el = box.current;
    if (el && follow.current) el.scrollTop = el.scrollHeight;
  }, [count]);

  useEffect(() => {
    if (highlightedJobId === null) return;
    box.current
      ?.querySelector(`[data-job-card="${CSS.escape(highlightedJobId)}"]`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [highlightedJobId]);

  const toggle = (id: string) => {
    onSelectJob(id);
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      ref={box}
      onScroll={(e) => {
        const el = e.currentTarget;
        follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
      }}
      className="flex min-h-0 flex-col gap-2 overflow-y-auto"
    >
      {canLoadOlder && (
        <button
          type="button"
          onClick={onLoadOlder}
          className="self-start rounded-full border border-border px-3 py-1 text-xs hover:bg-accent"
        >
          Load older jobs
        </button>
      )}
      {views.length === 0 && <p>No jobs yet.</p>}
      {views.map((v) => (
        <JobCard
          key={v.id}
          view={v}
          expanded={open.has(v.id)}
          highlighted={v.id === highlightedJobId}
          onToggle={() => toggle(v.id)}
          onSelectSeq={onSelectSeq}
        />
      ))}
    </div>
  );
}
