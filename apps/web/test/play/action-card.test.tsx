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
  commitsOnOwnTurn: false,
  suggest: false,
  commit: { canCommit: true, authority: "declarer" },
  signoff: null,
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

test("a party card with sign-off rows shows state and own-row Approve and Object", () => {
  const html = renderToStaticMarkup(
    <ActionCard
      card={card({
        scope: "party",
        signoff: [
          { userId: "u1", label: "You", state: "approved", isViewer: true },
          { userId: "u2", label: "Cleo", state: "objects", isViewer: false },
          { userId: "u3", label: "Dov", state: "absent", isViewer: false },
        ],
      })}
      onComment={noop}
      onCommit={noop}
      onWithdraw={noop}
    />,
  );
  expect(html).toContain('aria-label="Sign-off"');
  expect(html).toContain("Approved");
  expect(html).toContain("Objects");
  expect(html).toContain("Away");
  const section = html.slice(html.indexOf('aria-label="Sign-off"'));
  const list = section.slice(0, section.indexOf("</section>"));
  expect(list.match(/>Approve</g)?.length).toBe(1);
  expect(list.match(/>Object</g)?.length).toBe(1);
  expect(html).not.toContain("<dialog");
});

test("a card without sign-off rows has no sign-off section", () => {
  expect(render(card())).not.toContain('aria-label="Sign-off"');
});

test("a non-active player's own open action says it commits on their turn", () => {
  const html = render(
    card({
      commit: { canCommit: false, holderLabel: "Ana" },
      commitsOnOwnTurn: true,
    }),
  );
  expect(html).toContain("Commits on your turn");
  expect(html).not.toContain("Waiting for Ana to commit");
});

test("without the flag the card still says who it waits for", () => {
  const html = render(
    card({ commit: { canCommit: false, holderLabel: "Ana" } }),
  );
  expect(html).toContain("Waiting for Ana to commit");
  expect(html).not.toContain("Commits on your turn");
});

test("a suggestion card labels the comment input and keeps the stances", () => {
  const html = render(card({ suggest: true }));
  expect(html).toContain('aria-label="Suggest an alternative"');
  expect(html).toContain('placeholder="Suggest an alternative"');
  expect(html).not.toContain('aria-label="Comment on this action"');
  for (const s of ["Comment", "Approve", "Object"]) expect(html).toContain(s);
});
