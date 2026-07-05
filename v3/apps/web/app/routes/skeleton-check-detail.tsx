import { useEffect } from "react";
import { useRevalidator } from "react-router";

import { getSkeletonCheck } from "~/lib/api.server";
import type { Route } from "./+types/skeleton-check-detail";

const TERMINAL_STATUSES = new Set(["succeeded", "failed"]);

export async function loader({ request, params }: Route.LoaderArgs) {
  const run = await getSkeletonCheck(request, params.id!);
  if (!run) {
    throw new Response("Not found", { status: 404 });
  }
  return { run };
}

export default function SkeletonCheckDetail({ loaderData }: Route.ComponentProps) {
  const run = loaderData?.run;
  const revalidator = useRevalidator();

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

      {run.outcome ? (
        <p className="mt-2 text-sm text-[hsl(var(--destructive))]">
          Failed at <strong>{run.outcome.seam}</strong>: {run.outcome.message} ({run.outcome.class})
        </p>
      ) : null}

      {run.vector ? (
        <div className="mt-4 rounded-md border border-[hsl(var(--border))] p-3 text-sm">
          <p>Vector: {run.vector.id.slice(0, 12)}…</p>
          <p>
            Provider/model: {run.vector.provider} / {run.vector.model} ({run.vector.dimensions}d)
          </p>
          <p>Readback distance: {run.vector.readbackDistance}</p>
        </div>
      ) : null}

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
