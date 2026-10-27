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
  comments: [{ seq: 5, actorLabel: "Bram", stance: "approve", text: "Go on." }],
  open: true,
  canWithdraw: false,
  commit: { canCommit: true, authority: "declarer" },
  committed: null,
  resolved: null,
  ...over,
});
const render = (c: ActionCardView) =>
  renderToStaticMarkup(
    <ActionCard card={c} onComment={noop} onCommit={noop} onWithdraw={noop} />,
  );

test("an open card shows comments with stance and the comment form", () => {
  const html = render(card());
  expect(html).toContain("Bram");
  expect(html).toContain("approved");
  expect(html).toContain("Go on.");
  expect(html).toContain('aria-label="Comment on this action"');
  for (const s of ["Comment", "Approve", "Object"]) expect(html).toContain(s);
  expect(html).toContain(">Commit<");
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
