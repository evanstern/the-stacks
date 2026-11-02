import { Link, useRouteLoaderData, useSearchParams } from "react-router";
import type { loader as rootLoader } from "~/root";
import { OperatorOnly } from "~/shell/operator-only";
import { FixtureToolbar } from "../play/components/fixture-toolbar.tsx";
import { TableView } from "../play/table-view.tsx";
import { useFixtureTable } from "../play/use-fixture-table.ts";
import type { Route } from "./+types/play-fixture";

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { fixtures, fixtureIds } = await import(
    "@the-stacks/session-model/fixtures"
  );
  const fixture = fixtures.find((f) => f.name === params.fixtureName) ?? null;
  return { fixture, dmActor: fixtureIds.dmActor as string };
}

export function HydrateFallback() {
  return <p>Loading…</p>;
}

export default function PlayFixture({ loaderData }: Route.ComponentProps) {
  const root = useRouteLoaderData<typeof rootLoader>("root");
  if (root?.user?.role !== "operator") {
    return (
      <OperatorOnly message="The fixture table is available to the operator only." />
    );
  }
  const { fixture } = loaderData;
  if (!fixture) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p>No such fixture.</p>
        <Link to="/play/fixtures" className="text-primary underline">
          Back to fixtures
        </Link>
      </div>
    );
  }
  return <FixtureBody loaderData={{ fixture, dmActor: loaderData.dmActor }} />;
}

function FixtureBody({
  loaderData,
}: {
  loaderData: {
    fixture: NonNullable<Route.ComponentProps["loaderData"]["fixture"]>;
    dmActor: string;
  };
}) {
  const { fixture, dmActor } = loaderData;
  const [params, setParams] = useSearchParams();
  const last = fixture.events.at(-1)?.seq ?? 0;
  const viewerKey = params.get("as") ?? "dm";
  const parsed = Number(params.get("through"));
  const through =
    params.get("through") !== null && Number.isInteger(parsed)
      ? Math.min(Math.max(parsed, 0), last)
      : last;
  const source = useFixtureTable(fixture, viewerKey, through, dmActor);

  function update(next: { as?: string; through?: number }) {
    const merged = new URLSearchParams(params);
    if (next.as !== undefined) merged.set("as", next.as);
    if (next.through !== undefined) merged.set("through", String(next.through));
    setParams(merged, { replace: true });
  }

  return (
    <div className="h-dvh overflow-hidden narrow:h-[calc(100dvh-3.5rem)] flex min-h-0 flex-1 flex-col">
      <FixtureToolbar
        fixture={fixture}
        viewerKey={viewerKey}
        through={through}
        onViewer={(as) => update({ as })}
        onThrough={(seq) => update({ through: seq })}
      />
      <TableView source={source} />
    </div>
  );
}
