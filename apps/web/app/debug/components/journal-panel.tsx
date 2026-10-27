import type { JournalEntryView } from "@the-stacks/session-model";
import { Panel } from "~/components/panel";

/** Journal entries through the projection's seq; `dm` visibility is marked (FR-045). */
export function JournalBody({
  entries,
}: {
  entries: readonly JournalEntryView[];
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No journal entries.</p>;
  }
  return (
    <ol className="space-y-3">
      {entries.map((e) => (
        <li
          key={e.entryId}
          className="rounded-md border border-border bg-card p-3"
        >
          <p className="text-sm font-medium">
            {e.title}
            {e.visibility === "dm" && (
              <span className="ml-2 rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-normal">
                DM only
              </span>
            )}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{e.body}</p>
          <p className="mt-1 text-xs text-muted-foreground">seq {e.seq}</p>
        </li>
      ))}
    </ol>
  );
}

export function JournalPanel({
  open,
  onOpenChange,
  entries,
  pinnedSeq,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: readonly JournalEntryView[];
  pinnedSeq: number | null;
}) {
  return (
    <Panel
      open={open}
      onOpenChange={onOpenChange}
      title={pinnedSeq === null ? "Journal" : `Journal at seq ${pinnedSeq}`}
      description="Chronicle entries."
    >
      <JournalBody entries={entries} />
    </Panel>
  );
}
