/**
 * /evals/gold — the labeling bench (spec 010 US3). Gold items are the eval
 * program's ground truth, so the page leads with the LABELING STANDARD
 * (FR-012) and keeps the re-confirmation queue loud: an item whose expected
 * passage was rewritten by a re-ingest is a question whose answer key went
 * stale — eval runs count it unresolvable until a human re-labels it.
 *
 * Authoring flows FROM search: /search results carry a "label as expected"
 * link that lands here with the chunk id and query prefilled (?chunkId&q).
 * Splits render as badges and never move — the API refuses (FR-013), and
 * this page doesn't even offer the control on existing items.
 */
import { Form, Link, useSearchParams } from "react-router";

import { createGoldItem, listGoldItems, relabelGoldItem } from "~/lib/api.server";
import type { Route } from "./+types/evals.gold";

export async function loader({ request }: Route.LoaderArgs) {
  return { items: await listGoldItems(request) };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const question = String(form.get("question") ?? "").trim();
  const chunkIds = String(form.get("chunkIds") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const itemId = String(form.get("itemId") ?? "");
  const notes = String(form.get("notes") ?? "").trim() || undefined;

  const result = itemId
    ? await relabelGoldItem(request, itemId, { question, chunkIds, notes })
    : await createGoldItem(request, {
        question,
        chunkIds,
        split: form.get("split") === "heldout" ? "heldout" : undefined,
        notes,
      });
  return result.ok ? { error: null } : { error: result.message };
}

export default function GoldSet({ loaderData, actionData }: Route.ComponentProps) {
  const { items } = loaderData;
  const [params] = useSearchParams();
  const flagged = items.filter((item) => item.needsReconfirmation);

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Gold set</h1>
        <p className="text-sm text-muted-foreground">
          {/* The labeling standard, visible at authoring time (FR-012). */}
          <strong>Labeling standard:</strong> an expected passage is one whose text ALONE answers
          the question — not one that merely mentions its topic. Label from real search results
          (each result offers “label as expected”).
        </p>
      </header>

      {actionData?.error && (
        <p role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">
          {actionData.error}
        </p>
      )}

      {flagged.length > 0 && (
        <section aria-label="Needs re-confirmation" className="rounded-md border border-amber-300 p-4">
          <h2 className="font-medium">
            Needs re-confirmation ({flagged.length})
          </h2>
          <p className="text-xs text-muted-foreground">
            A re-ingest rewrote these items’ expected passages. Until re-labeled, eval runs count
            them unresolvable — never a silent miss.
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {flagged.map((item) => (
              <li key={item.id} data-testid="reconfirm-item">
                “{item.question}” —{" "}
                <Link className="underline" to={`/search?q=${encodeURIComponent(item.question)}`}>
                  find the new passage
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Add gold item" className="rounded-md border p-4">
        <h2 className="font-medium">Add an item</h2>
        <Form method="post" className="mt-2 space-y-3">
          <input type="hidden" name="itemId" value={params.get("itemId") ?? ""} />
          <label className="block text-sm">
            Question
            <input
              name="question"
              defaultValue={params.get("q") ?? ""}
              required
              maxLength={1024}
              className="mt-1 w-full rounded-md border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Expected chunk ids (comma-separated — use “label as expected” from search)
            <input
              name="chunkIds"
              defaultValue={params.get("chunkId") ?? ""}
              required
              className="mt-1 w-full rounded-md border px-3 py-2 font-mono text-xs"
            />
          </label>
          <label className="block text-sm">
            Notes (labeling rationale, optional)
            <input name="notes" className="mt-1 w-full rounded-md border px-3 py-2" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="split" value="heldout" />
            Force into the held-out split (default: every 4th item lands there automatically)
          </label>
          <button type="submit" className="rounded-md border px-4 py-2">
            Save gold item
          </button>
        </Form>
      </section>

      <section aria-label="Gold items" className="space-y-2">
        <h2 className="font-medium">
          Items ({items.length})
        </h2>
        {items.length === 0 ? (
          <p data-testid="empty-state" className="text-sm text-muted-foreground">
            No gold items yet —{" "}
            <Link className="underline" to="/search">
              search for a passage
            </Link>{" "}
            and label it.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span>“{item.question}”</span>
                  <span
                    data-testid="split-badge"
                    className="rounded bg-muted px-1.5 py-0.5 text-xs uppercase tracking-wide"
                  >
                    {item.split}
                  </span>
                  {item.needsReconfirmation && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">
                      needs re-confirmation
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.expected.length} expected passage{item.expected.length === 1 ? "" : "s"}
                  {item.notes ? ` · ${item.notes}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
