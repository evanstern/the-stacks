import { KeyRound } from "lucide-react";
import { redirect } from "react-router";

import type { Route } from "./+types/login";
import { Button } from "~/components/ui/button";
import {
  buildAuthCookieHeader,
  sanitizeNext,
  signAuthCookie,
  verifySharedPassword,
} from "~/lib/auth.server";

export const meta: Route.MetaFunction = () => [
  { title: "Sign in · Ikis" },
  { name: "description", content: "Shared-password sign in for the private Ikis workspace." },
];

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);

  return {
    error: url.searchParams.get("error") === "1",
    next: sanitizeNext(url.searchParams.get("next")),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const next = sanitizeNext(String(formData.get("next") ?? "/"));

  if (!verifySharedPassword(formData.get("password"))) {
    return redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  }

  return redirect(next, {
    headers: { "Set-Cookie": buildAuthCookieHeader(signAuthCookie()) },
  });
}

export default function Login({ loaderData }: Route.ComponentProps) {
  const { error, next } = loaderData;

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12 text-[var(--color-foreground)]">
      <section className="w-full max-w-md overflow-hidden rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-panel)]">
        <div className="border-b border-[var(--color-border)] bg-[hsl(39_45%_96%_/_0.58)] px-8 py-7">
          <div className="flex items-center gap-3 text-[var(--color-primary)]">
            <KeyRound className="h-5 w-5" />
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-muted-foreground)]">
              private workspace
            </p>
          </div>
          <h1 className="mt-4 font-[var(--font-display)] text-5xl font-bold tracking-[-0.03em] text-[var(--color-card-foreground)]">
            Ikis
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--color-muted-foreground)]">
            Sign in with the owner password to upload, review, and ask grounded corpus questions.
          </p>
        </div>

        <form method="post" className="grid gap-5 p-8">
          <input type="hidden" name="next" value={next} />
          <label className="grid gap-2 text-sm font-semibold text-[var(--color-card-foreground)]">
            Password
            <input
              data-testid="login-password"
              name="password"
              type="password"
              required
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3 text-base text-[var(--color-card-foreground)] outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
              placeholder="Enter the Ikis password"
            />
          </label>

          {error ? (
            <p className="rounded-2xl border border-[hsl(12_82%_48%_/_0.28)] bg-[hsl(12_82%_48%_/_0.08)] px-4 py-3 text-sm font-semibold text-[hsl(12_82%_38%)]" role="alert">
              Wrong password.
            </p>
          ) : null}

          <Button data-testid="login-submit" type="submit">
            Sign in
          </Button>
        </form>
      </section>
    </main>
  );
}
