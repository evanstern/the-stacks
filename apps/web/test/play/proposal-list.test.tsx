import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ProposalList } from "~/play/components/proposal-list";
import { fixtureProposals } from "~/play/fixtures/proposals";

const list = fixtureProposals["free-mode-action"];
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
