import { useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "~/root";
import { DebugGate } from "../debug/components/debug-gate.tsx";
import type { Route } from "./+types/play-debug";

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  return { sessionId: params.sessionId };
}

export function HydrateFallback() {
  return <p>Loading…</p>;
}

export default function PlayDebug({ loaderData }: Route.ComponentProps) {
  const root = useRouteLoaderData<typeof rootLoader>("root");
  return <DebugGate sessionId={loaderData.sessionId} user={root?.user} />;
}
