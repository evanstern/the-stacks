import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { DebugGate } from "~/debug/components/debug-gate";

function recorder() {
  const calls: string[] = [];
  const fetchImpl = async (input: string) => {
    calls.push(input);
    return { ok: true, status: 200, json: async () => ({}) };
  };
  return { calls, fetchImpl };
}

test("a player gets OperatorOnly and no fetch", () => {
  const { calls, fetchImpl } = recorder();
  const html = renderToStaticMarkup(
    <DebugGate
      sessionId="s1"
      user={{ role: "player" }}
      fetchImpl={fetchImpl}
    />,
  );
  expect(html).toContain("The debug view is available to the operator only.");
  expect(html).not.toContain("Why the table is waiting");
  expect(calls).toEqual([]);
});

test("a signed-out root gets OperatorOnly", () => {
  const html = renderToStaticMarkup(<DebugGate sessionId="s1" user={null} />);
  expect(html).toContain("operator only");
});

test("an operator gets the strip region", () => {
  const { fetchImpl } = recorder();
  const html = renderToStaticMarkup(
    <DebugGate
      sessionId="s1"
      user={{ role: "operator" }}
      fetchImpl={fetchImpl}
    />,
  );
  expect(html).toContain("Why the table is waiting");
  expect(html).not.toContain("<dialog");
});
