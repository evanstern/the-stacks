import type { StoredEvent } from "@the-stacks/session-model";
import { useMemo, useState } from "react";
import {
  distinctValues,
  type EventFilter,
  emptyFilter,
  filterEvents,
  windowRows,
} from "../event-filter.ts";
import { TypeFilter } from "./type-filter.tsx";

const WINDOW = 500;

function timeText(ts: string): string {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? ts : d.toISOString().slice(11, 19);
}

/** The event log: filters, a 500-row window, payloads collapsed by default. */
export function EventLog({
  events,
  actorName,
  highlightSeqs,
  selectedSeq,
  onSelectSeq,
  initialFilter = emptyFilter,
}: {
  events: readonly StoredEvent[];
  actorName: (actor: string) => string;
  highlightSeqs: ReadonlySet<number>;
  selectedSeq: number | null;
  onSelectSeq: (seq: number) => void;
  initialFilter?: EventFilter;
}) {
  const [filter, setFilter] = useState<EventFilter>(initialFilter);
  const [windowSize, setWindowSize] = useState(WINDOW);
  const values = useMemo(() => distinctValues(events), [events]);
  const matched = useMemo(() => filterEvents(events, filter), [events, filter]);
  const rows = windowRows(matched, windowSize);
  const hidden = matched.length - rows.length;
  const change = (patch: Partial<EventFilter>) => {
    setFilter((f) => ({ ...f, ...patch }));
    setWindowSize(WINDOW);
  };
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex flex-col gap-1">
        <TypeFilter
          label="Filter types"
          options={values.types}
          selected={filter.types}
          onChange={(types) => change({ types })}
        />
        <TypeFilter
          label="Filter actors"
          options={values.actors}
          selected={filter.actors}
          onChange={(actors) => change({ actors })}
        />
        <TypeFilter
          label="Filter visibility"
          options={values.visibilities}
          selected={filter.visibilities}
          onChange={(visibilities) => change({ visibilities })}
        />
      </div>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setWindowSize((n) => n + WINDOW)}
          className="self-start rounded-full border border-border px-3 py-1 text-xs hover:bg-accent"
        >
          Show {Math.min(WINDOW, hidden)} older
        </button>
      )}
      <ol className="flex flex-col gap-1">
        {rows.map((e) => (
          <li
            key={e.seq}
            data-seq={e.seq}
            data-highlight={highlightSeqs.has(e.seq) ? "true" : undefined}
            data-selected={e.seq === selectedSeq ? "true" : undefined}
            className={`rounded border px-2 py-1 text-xs text-foreground ${
              e.seq === selectedSeq
                ? "border-primary bg-accent"
                : highlightSeqs.has(e.seq)
                  ? "border-primary/60 bg-accent/50"
                  : "border-border"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelectSeq(e.seq)}
              className="flex w-full flex-wrap gap-x-3 text-left"
            >
              <span className="font-mono">#{e.seq}</span>
              <span className="text-muted-foreground">{timeText(e.ts)}</span>
              <span>{actorName(e.actor)}</span>
              <span className="font-medium">{e.type}</span>
              <span className="text-muted-foreground">{e.visibility}</span>
            </button>
            <details>
              <summary className="cursor-pointer text-muted-foreground">
                payload
              </summary>
              <pre className="mt-1 max-h-60 overflow-auto rounded bg-muted p-2">
                {JSON.stringify(e.payload, null, 2)}
              </pre>
            </details>
          </li>
        ))}
        {rows.length === 0 && <li>No events match.</li>}
      </ol>
    </div>
  );
}
