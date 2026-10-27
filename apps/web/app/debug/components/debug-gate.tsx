import { OperatorOnly } from "~/shell/operator-only";
import type { FetchLike } from "../client.ts";
import { DebugView } from "./debug-view.tsx";

export const DEBUG_OPERATOR_ONLY =
  "The debug view is available to the operator only.";

/** Renders the debug view for an operator; anyone else gets OperatorOnly and no fetch. */
export function DebugGate({
  sessionId,
  user,
  fetchImpl,
}: {
  sessionId: string;
  user: { role: string } | null | undefined;
  fetchImpl?: FetchLike;
}) {
  if (user?.role !== "operator")
    return <OperatorOnly message={DEBUG_OPERATOR_ONLY} />;
  return <DebugView sessionId={sessionId} fetchImpl={fetchImpl} />;
}
