import { project } from "@the-stacks/session-model";
import {
  freeModeAction,
  secretTracker,
  turnModeCombat,
} from "@the-stacks/session-model/fixtures";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { LedgerList } from "~/play/components/ledger-list";
import { toLedgerItems } from "~/play/ledger-format";

type Fx = typeof freeModeAction;
const render = (f: Fx, viewer: Fx["viewers"]["dm"]) =>
  renderToStaticMarkup(
    <LedgerList items={toLedgerItems(project(f.events, viewer).ledger)} />,
  );

test("a roll shows reason, expression, face, total and the check outcome", () => {
  const html = render(freeModeAction, freeModeAction.viewers.dm);
  expect(html).toContain("1d20+5");
  expect(html).toContain("13");
  expect(html).toContain("Total 18");
  expect(html).toContain("Success");
  expect(html).not.toContain("<dialog");
});

test("a change shows hp.current before and after", () => {
  const html = render(turnModeCombat, turnModeCombat.viewers.dm);
  expect(html).toContain("hp.current");
  expect(html).toContain(" → ");
});

test("hidden rolls: absent for a player, marked DM-only for the DM", () => {
  const player = render(secretTracker, secretTracker.viewers.players[0]);
  const dm = render(secretTracker, secretTracker.viewers.dm);
  expect(player).not.toContain("DM-only");
  expect(dm).toContain("DM-only");
});

test("a creation shows none before", () => {
  const items = toLedgerItems(
    project(secretTracker.events, secretTracker.viewers.dm).ledger,
  );
  const html = renderToStaticMarkup(<LedgerList items={items} />);
  expect(html).toContain("none");
});
