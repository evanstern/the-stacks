/**
 * Home ("/") — the protected index route: trigger a skeleton check, list
 * recent runs, sign out. Rendered inside protected-layout, so by the time
 * this loader runs the session has already been verified.
 *
 * All data flows through server-side loader/action calls into
 * lib/api.server.ts (contract: specs/007-v3-skeleton/contracts/api.md);
 * the browser only ever submits plain HTML forms back to this route.
 */
import { Form, Link, redirect } from "react-router";

import { Button } from "~/components/ui/button";
import { listSkeletonChecks, logout, triggerSkeletonCheck } from "~/lib/api.server";
import type { Route } from "./+types/home";

export async function loader({ request }: Route.LoaderArgs) {
  const runs = await listSkeletonChecks(request);
  return { runs };
}

// One action, two intents: both forms on this page POST here (RR7 index
// routes submit to "?index" — the framework bakes that into the form action).
// A hidden "intent" field distinguishes logout from the default intent,
// run-skeleton-check.
export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();

  if (form.get("intent") === "logout") {
    const response = await logout(request);
    // Relay the API's session-clearing Set-Cookie onto the redirect — the
    // API owns the cookie; web just passes it through (research R9).
    const headers = new Headers();
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      headers.set("set-cookie", setCookie);
    }
    throw redirect("/login", { headers });
  }

  // Default intent: trigger a check. The API replies 202 (accept-then-async);
  // we redirect straight to the detail page, which polls until terminal.
  const run = await triggerSkeletonCheck(request);
  throw redirect(`/skeleton-checks/${run.id}`);
}

export default function Home({ loaderData }: Route.ComponentProps) {
  // Fallback guards against test harnesses rendering before hydration data
  // resolves; in real SSR loaderData is always present.
  const { runs } = loaderData ?? { runs: [] };

  return (
    <main className="mx-auto max-w-lg p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">the Stacks v3</h1>
        <Form method="post">
          <input type="hidden" name="intent" value="logout" />
          <Button type="submit" variant="destructive" size="sm">
            Sign out
          </Button>
        </Form>
      </div>

      <Form method="post" className="mt-6">
        <Button type="submit">Run skeleton check</Button>
      </Form>

      <h2 className="mt-8 text-sm font-medium text-muted-foreground">Recent runs</h2>
      <ul className="mt-2 flex flex-col gap-1">
        {runs.length === 0 ? <li className="text-sm text-muted-foreground">No runs yet.</li> : null}
        {runs.map((run) => (
          <li key={run.id}>
            <Link to={`/skeleton-checks/${run.id}`} className="text-sm underline">
              {run.id.slice(0, 8)} — {run.status}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
