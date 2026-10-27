import { dmApprovals } from "@the-stacks/session-model/fixtures";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ProposalList } from "~/play/components/proposal-list";
import { selectPendingProposals } from "~/play/proposals";

const list = selectPendingProposals(dmApprovals.events, dmApprovals.viewers.dm);
const noop = () => {};

test("each proposal shows summary, kind, proposer, action, details and buttons", () => {
  const html = renderToStaticMarkup(
    <ProposalList proposals={list} onApprove={noop} onReject={noop} />,
  );
  for (const p of list) {
    expect(html).toContain(p.summary);
    expect(html).toContain(p.kind);
    expect(html).toContain(p.proposerLabel);
    for (const d of p.details) {
      expect(html).toContain(d.label);
      expect(html).toContain(d.value);
    }
    if (p.actionId) expect(html).toContain(p.actionId);
  }
  expect(html).toContain(">Approve<");
  expect(html).toContain(">Reject<");
  expect(html).not.toContain("Confirm reject");
  expect(html).not.toContain("<dialog");
});

test("an empty list shows No pending proposals", () => {
  const html = renderToStaticMarkup(
    <ProposalList proposals={[]} onApprove={noop} onReject={noop} />,
  );
  expect(html).toContain("No pending proposals");
});

function rows(html: string): string[] {
  return html.split("<li").slice(1);
}

test("a suggest row shows Suggestion and Dismiss and no Approve (AC #3)", () => {
  const html = renderToStaticMarkup(
    <ProposalList proposals={list} onApprove={noop} onReject={noop} />,
  );
  const items = rows(html);
  const p3 = items[list.findIndex((p) => p.policy === "suggest")];
  expect(p3).toContain("Suggestion");
  expect(p3).toContain(">Dismiss<");
  expect(p3).not.toContain(">Approve<");
  expect(p3).not.toContain(">Reject<");
  expect(p3).not.toContain("Reason for rejecting");
  // T006: Dismiss is a plain button.
  expect(p3).toMatch(/<button type="button"[^>]*>Dismiss</);
});

test("ask rows keep Approve and Reject and have no Dismiss", () => {
  const html = renderToStaticMarkup(
    <ProposalList proposals={list} onApprove={noop} onReject={noop} />,
  );
  const items = rows(html);
  list.forEach((p, i) => {
    if (p.policy !== "ask") return;
    expect(items[i]).toContain(">Approve<");
    expect(items[i]).toContain(">Reject<");
    expect(items[i]).not.toContain(">Dismiss<");
  });
});

test("a suggest-only list contains no Approve", () => {
  const html = renderToStaticMarkup(
    <ProposalList
      proposals={list.filter((p) => p.policy === "suggest")}
      onApprove={noop}
      onReject={noop}
    />,
  );
  expect(html).not.toContain(">Approve<");
  expect(html).toContain(">Dismiss<");
});
