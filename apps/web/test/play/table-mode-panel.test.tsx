import { project } from "@the-stacks/session-model";
import { turnModeCombat } from "@the-stacks/session-model/fixtures";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import {
  endInput,
  modeInput,
  TableModePanel,
} from "~/play/components/table-mode-panel";
import { appendLocal, localTableModeEvents } from "~/play/local-log";
import { type TableModeView, tableModeView } from "~/play/table-mode";

const dm = turnModeCombat.viewers.dm;
const upTo = (seq: number) => turnModeCombat.events.filter((e) => e.seq <= seq);
const turnView = tableModeView(project(upTo(18), dm));
const freeView = (() => {
  const events = upTo(18);
  const row = localTableModeEvents(project(events, dm), {
    reason: "Free.",
    after: { mode: "free" },
  });
  if (!row) throw new Error("row");
  return tableModeView(project(appendLocal(events, row, "u"), dm));
})();
const noEncounter: TableModeView = {
  mode: "free",
  encounterActive: false,
  canEnd: false,
  canFree: false,
  turnAfter: null,
};

const yes = () => true;
const html = (view: TableModeView) =>
  renderToStaticMarkup(
    <TableModePanel view={view} onEndEncounter={yes} onSetMode={yes} />,
  );

test("turn mode with an encounter", () => {
  const out = html(turnView);
  expect(out).toContain("Turn mode");
  expect(out).toContain("Encounter active.");
  expect(out).toContain(">End encounter<");
  expect(out).toContain(">Switch to free mode<");
  expect(out).toContain("The encounter stays active.");
  expect(out).not.toContain("Switch to turn mode");
  expect(out).toContain("Reason (optional)");
  expect(out).not.toContain('role="dialog"');
});

test("free mode with an encounter", () => {
  const out = html(freeView);
  expect(out).toContain("Free mode");
  expect(out).toContain(">Switch to turn mode<");
  expect(out).toContain(">End encounter<");
  expect(out).not.toContain("Switch to free mode");
});

test("free mode with no encounter shows only the note", () => {
  const out = html(noEncounter);
  expect(out).toContain("No encounter.");
  expect(out).toContain("Turn mode needs an encounter. The AI DM starts one.");
  expect(out).not.toContain("<button");
  expect(out).not.toContain('role="dialog"');
});

test("click helpers build the contract inputs", () => {
  expect(endInput(turnView, " r ")).toEqual({ reason: "r", thenFree: true });
  expect(endInput(freeView, "r")).toEqual({ reason: "r", thenFree: false });
  expect(modeInput(turnView, "free", "r")).toEqual({
    reason: "r",
    after: { mode: "free" },
  });
  expect(freeView.turnAfter).not.toBeNull();
  expect(modeInput(freeView, "turn", "r")).toEqual({
    reason: "r",
    after: freeView.turnAfter,
  });
});
