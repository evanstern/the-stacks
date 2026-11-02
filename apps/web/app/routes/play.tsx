import { useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "~/root";
import { TableView } from "../play/table-view.tsx";
import { useLiveTable } from "../play/use-live-table.ts";
import type { Route } from "./+types/play";

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  return { sessionId: params.sessionId };
}

export function HydrateFallback() {
  return <p>Loading…</p>;
}

export default function Play({ loaderData }: Route.ComponentProps) {
  const root = useRouteLoaderData<typeof rootLoader>("root");
  if (!root?.user) return <HydrateFallback />;
  return <LiveTable sessionId={loaderData.sessionId} user={root.user} />;
}

function LiveTable({
  sessionId,
  user,
}: {
  sessionId: string;
  user: { id: string; role: string };
}) {
  const source = useLiveTable(sessionId, user);
  const debugHref =
    user.role === "operator" ? `/play/${sessionId}/debug` : undefined;
  return (
    <div className="h-dvh overflow-hidden narrow:h-[calc(100dvh-3.5rem)]">
      <TableView source={source} debugHref={debugHref} />
    </div>
  );
}
