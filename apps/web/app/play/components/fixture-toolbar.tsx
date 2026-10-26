import type { SessionFixture } from "@the-stacks/session-model/fixtures";

export function viewerOptions(fixture: SessionFixture): {
  key: string;
  label: string;
}[] {
  return [
    { key: "dm", label: "DM" },
    ...fixture.viewers.players.flatMap((v, i) =>
      v.role === "player" ? [{ key: v.userId, label: `Player ${i + 1}` }] : [],
    ),
  ];
}

/** Rendered by the fixture route above `TableView`, never inside it. */
export function FixtureToolbar({
  fixture,
  viewerKey,
  through,
  onViewer,
  onThrough,
}: {
  fixture: SessionFixture;
  viewerKey: string;
  through: number;
  onViewer: (key: string) => void;
  onThrough: (seq: number) => void;
}) {
  const total = fixture.events.at(-1)?.seq ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-muted px-3 py-2 text-sm">
      <strong>{fixture.name}</strong>
      <fieldset
        aria-label="View as"
        className="m-0 flex min-w-0 items-center gap-1 border-0 p-0"
      >
        <span className="text-muted-foreground">View as</span>
        {viewerOptions(fixture).map((o) => (
          <button
            key={o.key}
            type="button"
            aria-pressed={o.key === viewerKey}
            onClick={() => onViewer(o.key)}
            className="rounded-full border border-border px-3 py-1 hover:bg-accent aria-pressed:bg-accent aria-pressed:font-medium"
          >
            {o.label}
          </button>
        ))}
      </fieldset>
      <fieldset
        aria-label="Step"
        className="m-0 flex min-w-0 items-center gap-1 border-0 p-0"
      >
        <button
          type="button"
          aria-label="Previous event"
          disabled={through <= 0}
          onClick={() => onThrough(Math.max(0, through - 1))}
          className="rounded-md border border-border px-2 py-1 hover:bg-accent disabled:opacity-50"
        >
          ◂
        </button>
        <span>
          seq {through}/{total}
        </span>
        <button
          type="button"
          aria-label="Next event"
          disabled={through >= total}
          onClick={() => onThrough(Math.min(total, through + 1))}
          className="rounded-md border border-border px-2 py-1 hover:bg-accent disabled:opacity-50"
        >
          ▸
        </button>
      </fieldset>
      <span className="text-muted-foreground">Fixture — changes are local</span>
    </div>
  );
}
