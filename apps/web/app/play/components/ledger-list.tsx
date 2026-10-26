import type { LedgerItem } from "../ledger-format.ts";

function Faces({
  dice,
}: {
  dice: { sides: number; faces: number[]; kept: boolean[] }[];
}) {
  return (
    <span className="text-sm">
      {dice.map((die, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: dice have no id; the order is fixed.
        <span key={i} className="mr-2">
          d{die.sides}:{" "}
          {die.faces.map((face, j) =>
            die.kept[j] === false ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: faces have no id; the order is fixed.
              <s key={j} className="mr-1 text-muted-foreground">
                {face}
              </s>
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: faces have no id; the order is fixed.
              <span key={j} className="mr-1">
                {face}
              </span>
            ),
          )}
        </span>
      ))}
    </span>
  );
}

function DmOnly() {
  return (
    <span className="ml-2 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      DM-only
    </span>
  );
}

/** Roll, outcome and change rows, newest last (FR for US4). */
export function LedgerList({ items }: { items: readonly LedgerItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing rolled yet.</p>;
  }
  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li
          key={`${item.kind}-${item.seq}`}
          className="rounded-md border border-border bg-card p-3"
        >
          <p className="text-sm font-medium">
            {item.reason}
            {item.hidden && <DmOnly />}
          </p>
          {item.kind === "roll" && (
            <p className="mt-1 text-sm">
              <span className="font-mono">{item.expression}</span>
              {" · "}
              <Faces dice={item.dice} />
              {item.modifier !== 0 && (
                <span>
                  {" "}
                  {item.modifier > 0 ? "+" : "−"}
                  {Math.abs(item.modifier)}
                </span>
              )}
              {" · "}
              <span>Total {item.total}</span>
            </p>
          )}
          {item.kind === "outcome" && (
            <p className="mt-1 text-sm">{item.summary}</p>
          )}
          {item.kind === "change" && (
            <div className="mt-1 text-sm">
              {item.subject && (
                <p className="text-xs text-muted-foreground">{item.subject}</p>
              )}
              <ul>
                {item.fields.map((f) => (
                  <li key={f.path}>
                    <span className="font-mono">{f.path}</span>: {f.before}
                    {" → "}
                    {f.after}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
