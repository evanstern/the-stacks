import { Panel } from "~/components/panel";
import type { SeedResult } from "../api-types.ts";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Flattens the seed to dotted paths so each `dmOnlyPaths` entry can be marked. */
function leaves(v: unknown, path: string, out: [string, string][]) {
  if (isRecord(v)) {
    const keys = Object.keys(v);
    if (keys.length === 0 && path) out.push([path, "{}"]);
    for (const k of keys) leaves(v[k], path ? `${path}.${k}` : k, out);
    return;
  }
  if (Array.isArray(v)) {
    if (v.length === 0 && path) out.push([path, "[]"]);
    v.forEach((x, i) => {
      leaves(x, `${path}[${i}]`, out);
    });
    return;
  }
  out.push([path, typeof v === "string" ? v : JSON.stringify(v)]);
}

const covered = (path: string, dmOnly: readonly string[]) =>
  dmOnly.some(
    (d) => path === d || path.startsWith(`${d}.`) || path.startsWith(`${d}[`),
  );

/** The seed body: every field named in `dmOnlyPaths` carries a "DM only" mark (FR-044). */
export function SeedBody({ seed }: { seed: SeedResult | null }) {
  if (seed === null) {
    return <p className="text-sm text-muted-foreground">Seed not loaded.</p>;
  }
  if (seed.kind === "none") {
    return <p className="text-sm">The scene has no scene seed.</p>;
  }
  if (seed.kind === "failed") {
    return (
      <p className="text-sm">
        The seed failed to load (the server refused it).
      </p>
    );
  }
  const rows: [string, string][] = [];
  leaves(seed.seed, "", rows);
  return (
    <div className="text-sm">
      <p className="mb-2 text-xs text-muted-foreground">Seed {seed.seedId}</p>
      <dl className="space-y-1.5">
        {rows.map(([path, value]) => (
          <div key={path} className="rounded-md border border-border p-2">
            <dt className="font-mono text-xs">
              {path || "(root)"}
              {covered(path, seed.dmOnlyPaths) && (
                <span className="ml-2 rounded-full border border-border bg-muted px-2 py-0.5 text-xs">
                  DM only
                </span>
              )}
            </dt>
            <dd className="whitespace-pre-wrap">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function SeedPanel({
  open,
  onOpenChange,
  seed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seed: SeedResult | null;
}) {
  return (
    <Panel
      open={open}
      onOpenChange={onOpenChange}
      title="Seed"
      description="The scene seed, with DM-only fields marked."
    >
      <SeedBody seed={seed} />
    </Panel>
  );
}
