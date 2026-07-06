/**
 * /skeleton-checks/:id — live view of one skeleton-check run.
 *
 * The API accepts checks asynchronously (202), so this page is the "watch it
 * finish" half of the flow home.tsx starts. It polls by revalidating its own
 * loader every 1.5s until the run hits a terminal status, then renders:
 * the six-seam append-only event trail with per-seam timings, the typed
 * failure outcome (class + seam) when failed, and the vector identity block
 * (provider/model/dimensions + readback distance) when succeeded.
 *
 * Polling via loader revalidation — not a browser fetch — keeps FR-019 /
 * research R9 intact: the browser only ever talks to the web server.
 * Run shape: specs/007-v3-skeleton/contracts/api.md.
 */
import { useEffect } from "react";
import { useRevalidator } from "react-router";

import { getSkeletonCheck } from "~/lib/api.server";
import type { Route } from "./+types/skeleton-check-detail";

// "succeeded" | "failed" — the two statuses after which the run record can
// never change, so polling stops.
const TERMINAL_STATUSES = new Set(["succeeded", "failed"]);

export async function loader({ request, params }: Route.LoaderArgs) {
  const run = await getSkeletonCheck(request, params.id!);
  if (!run) {
    throw new Response("Not found", { status: 404 });
  }
  return { run };
}

export default function SkeletonCheckDetail({ loaderData }: Route.ComponentProps) {
  // Optional-chained because test harnesses can render this component before
  // hydration data resolves; real SSR always supplies loaderData.
  const run = loaderData?.run;
  const revalidator = useRevalidator();

  // Poll while the run is in flight: revalidate() re-runs the loader (a
  // server round-trip, per R9 — never a direct API call). Keying the effect
  // on run.status means reaching a terminal status tears the interval down.
  useEffect(() => {
    if (!run || TERMINAL_STATUSES.has(run.status)) {
      return;
    }
    const interval = setInterval(() => revalidator.revalidate(), 1500);
    return () => clearInterval(interval);
  }, [run?.status, revalidator]);

  if (!run) {
    return null;
  }

  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="text-2xl font-semibold">Skeleton check</h1>
      <p className="mt-2">
        Status: <strong>{run.status}</strong>
      </p>

      {/* Typed failure outcome: which seam broke and its failure class.
          Only the API sets this, and only on failed runs. */}
      {run.outcome ? (
        <p className="mt-2 text-sm text-[hsl(var(--destructive))]">
          Failed at <strong>{run.outcome.seam}</strong>: {run.outcome.message} ({run.outcome.class})
        </p>
      ) : null}

      {/* Vector identity block (succeeded runs): proof the embedding was
          written and read back — readback distance ≈ 0 means round-trip OK. */}
      {run.vector ? (
        <div className="mt-4 rounded-md border border-[hsl(var(--border))] p-3 text-sm">
          <p>Vector: {run.vector.id.slice(0, 12)}…</p>
          <p>
            Provider/model: {run.vector.provider} / {run.vector.model} ({run.vector.dimensions}d)
          </p>
          <p>Readback distance: {run.vector.readbackDistance}</p>
        </div>
      ) : null}

      {/* The append-only event trail: one entry per seam, in emission order.
          Index keys are safe because entries are never reordered or removed. */}
      <ol className="mt-6 flex flex-col gap-1 text-sm">
        {run.events.map((event, index) => (
          <li key={index} className={event.ok ? undefined : "text-[hsl(var(--destructive))]"}>
            {event.seam} — {event.ok ? "ok" : "failed"}
            {event.durationMs != null ? ` (${event.durationMs}ms)` : ""}
          </li>
        ))}
      </ol>
    </main>
  );
}
