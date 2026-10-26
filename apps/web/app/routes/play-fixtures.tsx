import { Link, useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "~/root";
import { OperatorOnly } from "~/shell/operator-only";
import type { Route } from "./+types/play-fixtures";

export async function clientLoader(_args: Route.ClientLoaderArgs) {
  const { fixtures } = await import("@the-stacks/session-model/fixtures");
  return {
    fixtures: fixtures.map((f) => ({
      name: f.name,
      description: f.description,
    })),
  };
}

export function HydrateFallback() {
  return <p>Loading…</p>;
}

export default function PlayFixtures({ loaderData }: Route.ComponentProps) {
  const root = useRouteLoaderData<typeof rootLoader>("root");
  if (root?.user?.role !== "operator") {
    return (
      <OperatorOnly message="The fixture table is available to the operator only." />
    );
  }
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4 sm:p-6">
      <h1 className="text-xl font-semibold">Fixtures</h1>
      <ul className="flex flex-col gap-3">
        {loaderData.fixtures.map((f) => (
          <li key={f.name} className="rounded-lg border border-border p-3">
            <Link
              to={`/play/fixtures/${f.name}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {f.name}
            </Link>
            <p className="mt-1 text-sm text-muted-foreground">
              {f.description}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
