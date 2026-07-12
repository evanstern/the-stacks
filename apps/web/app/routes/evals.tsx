/**
 * /evals — measure before choosing (spec 010 US4, D11). Lists eval runs,
 * starts new ones (accept-then-async: the row appears as `running`; the
 * worker fills it in), and compares two completed runs side by side —
 * per-slice deltas, one variable at a time. The comparison is deliberately
 * client-side over two run records (no server state): receipts compose.
 *
 * URL-addressable throughout (Principle V): ?compare=idA,idB reproduces a
 * comparison; refresh shows a running run's current status.
 */
import { Form, Link, useSearchParams } from "react-router";

import type { EvalRunDetail, EvalRunListItem, SliceMetricsWire } from "~/lib/api.server";
import { getEvalRun, listEvalRuns, startEvalRun } from "~/lib/api.server";
import type { Route } from "./+types/evals";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const compare = url.searchParams.get("compare");
  const runs = await listEvalRuns(request);
  let comparison: { a: EvalRunDetail; b: EvalRunDetail } | null = null;
  if (compare) {
    const [idA, idB] = compare.split(",");
    if (idA && idB) {
      const [a, b] = await Promise.all([getEvalRun(request, idA), getEvalRun(request, idB)]);
      comparison = { a, b };
    }
  }
  return { runs, comparison };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const configName = String(form.get("configName") ?? "").trim();
  const overridesRaw = String(form.get("overrides") ?? "").trim();
  let overrides: Record<string, unknown> | undefined;
  if (overridesRaw) {
    try {
      overrides = JSON.parse(overridesRaw) as Record<string, unknown>;
    } catch {
      return { error: "Overrides must be valid JSON (e.g. {\"fusion\":\"weighted\"})." };
    }
  }
  const result = await startEvalRun(request, { configName, overrides });
  return result.ok ? { error: null } : { error: result.message };
}

function Metric({ value }: { value: number | undefined }) {
  return <span className="font-mono">{value === undefined ? "—" : value.toFixed(3)}</span>;
}

function SliceTable({ label, a, b }: { label: string; a: SliceMetricsWire | null; b?: SliceMetricsWire | null }) {
  if (!a) return null;
  const rows: Array<[string, number, number | undefined]> = [
    ["recall@5", a.recallAt5, b?.recallAt5],
    ["recall@10", a.recallAt10, b?.recallAt10],
    ["MRR", a.mrr, b?.mrr],
    ["nDCG@10", a.ndcgAt10, b?.ndcgAt10],
  ];
  return (
    <div>
      <h4 className="text-sm font-medium">{label} ({a.items} items)</h4>
      <table className="mt-1 text-sm">
        <tbody>
          {rows.map(([name, valueA, valueB]) => (
            <tr key={name}>
              <td className="pr-4 text-muted-foreground">{name}</td>
              <td className="pr-4"><Metric value={valueA} /></td>
              {valueB !== undefined && (
                <>
                  <td className="pr-4"><Metric value={valueB} /></td>
                  <td className={valueB - valueA > 0 ? "text-green-700" : valueB - valueA < 0 ? "text-destructive" : "text-muted-foreground"}>
                    {(valueB - valueA >= 0 ? "+" : "") + (valueB - valueA).toFixed(3)}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Evals({ loaderData, actionData }: Route.ComponentProps) {
  const { runs, comparison } = loaderData;
  const [params] = useSearchParams();
  const completed = runs.filter((run) => run.status === "completed");

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Eval runs</h1>
        <p className="text-sm text-muted-foreground">
          Measure before choosing (D11): every configuration change cites one of these runs.
        </p>
      </header>

      {actionData?.error && (
        <p role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">
          {actionData.error}
        </p>
      )}

      <section aria-label="Start an eval run" className="rounded-md border p-4">
        <h2 className="font-medium">Start a run</h2>
        <Form method="post" className="mt-2 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            Config name
            <input name="configName" required maxLength={128} placeholder="rrf-default"
              className="mt-1 block rounded-md border px-3 py-2" />
          </label>
          <label className="text-sm">
            Overrides (JSON, optional — the A/B variable)
            <input name="overrides" placeholder='{"fusion":"weighted","weightAlpha":0.5}'
              className="mt-1 block w-80 rounded-md border px-3 py-2 font-mono text-xs" />
          </label>
          <button type="submit" className="rounded-md border px-4 py-2">Run eval</button>
        </Form>
      </section>

      {comparison && (
        <section aria-label="Comparison" className="rounded-md border p-4" data-testid="comparison">
          <h2 className="font-medium">
            {comparison.a.configName} → {comparison.b.configName}
          </h2>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <SliceTable label="Tuning" a={comparison.a.metrics?.tuning ?? null} b={comparison.b.metrics?.tuning ?? null} />
            <SliceTable label="Held-out" a={comparison.a.metrics?.heldout ?? null} b={comparison.b.metrics?.heldout ?? null} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Columns: {comparison.a.configName} · {comparison.b.configName} · delta. Held-out
            validates the final choice; tuning drives it (FR-013).
          </p>
        </section>
      )}

      <section aria-label="Runs" className="space-y-2">
        <h2 className="font-medium">Runs ({runs.length})</h2>
        {runs.length === 0 ? (
          <p data-testid="empty-state" className="text-sm text-muted-foreground">
            No eval runs yet — build a{" "}
            <Link className="underline" to="/evals/gold">gold set</Link>{" "}
            and start one above.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4">Config</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">tuning r@10</th>
                <th className="py-2 pr-4">heldout r@10</th>
                <th className="py-2 pr-4">When</th>
                <th className="py-2">Compare</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-b">
                  <td className="py-2 pr-4">{run.configName}</td>
                  <td className="py-2 pr-4">
                    <span className={run.status === "failed" ? "text-destructive" : ""}>{run.status}</span>
                  </td>
                  <td className="py-2 pr-4"><Metric value={run.metrics?.tuning?.recallAt10} /></td>
                  <td className="py-2 pr-4"><Metric value={run.metrics?.heldout?.recallAt10} /></td>
                  <td className="py-2 pr-4">{new Date(run.createdAt).toLocaleString()}</td>
                  <td className="py-2">
                    {run.status === "completed" && completed.length >= 2 && (
                      <CompareLink runId={run.id} current={params.get("compare")} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

/** Two clicks build ?compare=a,b — the URL is the comparison (Principle V). */
function CompareLink({ runId, current }: { runId: string; current: string | null }) {
  const parts = (current ?? "").split(",").filter(Boolean);
  const next = parts.length === 1 && parts[0] !== runId ? `${parts[0]},${runId}` : runId;
  return (
    <Link className="underline" to={`?compare=${next}`}>
      {parts.length === 1 && parts[0] !== runId ? "compare with selected" : "select"}
    </Link>
  );
}
