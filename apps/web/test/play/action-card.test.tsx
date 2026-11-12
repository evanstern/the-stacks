import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ActionCard } from "~/play/components/action-card";
import { CommitControl } from "~/play/components/commit-control";
import type { ActionCardView } from "~/play/view-model";

const noop = () => true;
const card = (over: Partial<ActionCardView> = {}): ActionCardView => ({
  actionId: "act-1",
  characterLabel: "Ana",
  actorLabel: "You",
  scope: "character",
  text: "Ana picks the lock.",
  status: "discussed",
  open: true,
  canWithdraw: false,
  commit: { canCommit: true, authority: "declarer" },
  committed: null,
  resolved: null,
  ...over,
});
const render = (c: ActionCardView) =>
  renderToStaticMarkup(
    <ActionCard card={c} onCommit={noop} onWithdraw={noop} />,
  );

test("an open card has no comment form, no sign-off and no stance buttons (FR-005)", () => {
  const html = render(card());
  expect(html).not.toContain("Comment on this action");
  expect(html).not.toContain("Suggest an alternative");
  expect(html).not.toContain("Sign-off");
  expect(html).not.toContain("<form");
  expect(html).not.toContain(">Approve<");
  expect(html).not.toContain(">Object<");
  expect(html).not.toContain("Commits on your turn");
});

test("the DM's card keeps Commit as DM and Withdraw", () => {
  const html = render(
    card({ commit: { canCommit: true, authority: "dm" }, canWithdraw: true }),
  );
  expect(html).toContain("Commit as DM");
  expect(html).toContain(">Withdraw<");
});

test("a player's card shows no Commit button", () => {
  const html = render(
    card({ commit: { canCommit: false, holderLabel: null } }),
  );
  expect(html).not.toContain(">Commit<");
  expect(html).toContain("Waiting for a commit");
});

test("CommitControl renders Commit or who is awaited", () => {
  const can = renderToStaticMarkup(
    <CommitControl
      commit={{ canCommit: true, authority: "declarer" }}
      onCommit={() => {}}
    />,
  );
  expect(can).toContain(">Commit<");
  const dm = renderToStaticMarkup(
    <CommitControl
      commit={{ canCommit: true, authority: "dm" }}
      onCommit={() => {}}
    />,
  );
  expect(dm).toContain("Commit as DM");
  const wait = renderToStaticMarkup(
    <CommitControl
      commit={{ canCommit: false, holderLabel: "Ana" }}
      onCommit={() => {}}
    />,
  );
  expect(wait).toContain("Waiting for Ana to commit");
  expect(wait).not.toContain("<button");
});

test("a committed card has no form and no control", () => {
  const html = render(
    card({
      status: "committed",
      open: false,
      commit: { canCommit: false, holderLabel: null },
      committed: { actorLabel: "You", authority: "declarer" },
    }),
  );
  expect(html).not.toContain("<form");
  expect(html).not.toContain("<button");
  expect(html).toContain("Committed by You");
});

test("a refused resolution shows its code", () => {
  const html = render(
    card({
      status: "resolved",
      open: false,
      commit: { canCommit: false, holderLabel: null },
      committed: { actorLabel: "You", authority: "declarer" },
      resolved: { outcome: "refused", refusalCode: "out-of-turn" },
    }),
  );
  expect(html).toContain("refused");
  expect(html).toContain("out-of-turn");
});

test("an open card shows Withdraw only when the viewer may withdraw it", () => {
  expect(render(card({ canWithdraw: false }))).not.toContain(">Withdraw<");
  expect(render(card({ canWithdraw: true }))).toContain(">Withdraw<");
});

test("a withdrawn card is closed: no form, no control, no waiting line", () => {
  const html = render(
    card({
      status: "withdrawn",
      open: false,
      canWithdraw: false,
      commit: { canCommit: false, holderLabel: "Ana" },
    }),
  );
  expect(html).toContain("Withdrawn");
  expect(html).not.toContain("<form");
  expect(html).not.toContain("<button");
  expect(html).not.toContain("Waiting for");
});
