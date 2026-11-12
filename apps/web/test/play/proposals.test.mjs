import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dmApprovals,
  freeModeAction,
  proposalExamples,
} from "@the-stacks/session-model/fixtures";
import { selectPendingProposals } from "../../app/play/proposals.ts";

const dm = dmApprovals.viewers.dm;

test("pending proposals are listed oldest first; decided ones are absent", () => {
  const list = selectPendingProposals(dmApprovals.events, dm);
  assert.equal(list.length, 3);
  assert.deepEqual(
    list.map((p) => p.kind),
    ["scene", "tracker", "table-mode"],
  );
  const seqs = list.map((p) => p.createdSeq);
  assert.deepEqual(
    seqs,
    [...seqs].sort((a, b) => a - b),
  );
});

test("every player viewer gets []", () => {
  for (const player of dmApprovals.viewers.players) {
    assert.deepEqual(selectPendingProposals(dmApprovals.events, player), []);
  }
});

test("a log with no proposal events gives []", () => {
  assert.deepEqual(
    selectPendingProposals(freeModeAction.events, freeModeAction.viewers.dm),
    [],
  );
});

test("a view carries summary, proposer label, action id and detail rows", () => {
  const [scene, tracker] = selectPendingProposals(dmApprovals.events, dm);
  assert.equal(scene.summary, proposalExamples.scene.summary ?? scene.summary);
  assert.equal(scene.proposer, "ai:dm");
  assert.equal(scene.proposerLabel, "DM");
  assert.ok(scene.details.length >= 2);
  assert.ok(
    tracker.details.some(
      (d) => d.label === "Visibility" && d.value === "DM only",
    ),
  );
  for (const p of [scene, tracker]) {
    assert.ok(p.proposalId);
    assert.ok(p.ts);
  }
});

test("a scene-presence proposal renders actor, reason, new value and visibility", () => {
  const last = dmApprovals.events[dmApprovals.events.length - 1];
  const row = {
    ...last,
    seq: last.seq + 1,
    actor: "ai:dm",
    type: "proposal.created",
    visibility: "dm",
    payloadVersion: 1,
    payload: {
      proposalId: "prop-presence",
      policy: "ask",
      proposal: { ...proposalExamples["scene-presence"], actorId: "goblin-1" },
    },
  };
  const list = selectPendingProposals([...dmApprovals.events, row], dm);
  const view = list.find((p) => p.proposalId === "prop-presence");
  assert.ok(view);
  assert.equal(view.kind, "scene-presence");
  assert.deepEqual(
    view.details.filter((d) => d.label !== "Rationale"),
    [
      { label: "Actor", value: "goblin-1" },
      { label: "Reason", value: "fled" },
      { label: "New value", value: "absent" },
      { label: "Visibility", value: "Everyone" },
    ],
  );
});

test("each pending proposal carries its recorded policy", () => {
  const list = selectPendingProposals(dmApprovals.events, dm);
  assert.deepEqual(
    list.map((p) => p.policy),
    ["suggest", "ask", "ask"],
  );
});

test("a floor proposal renders its request, reason and visibility", () => {
  const last = dmApprovals.events[dmApprovals.events.length - 1];
  const row = {
    ...last,
    seq: last.seq + 1,
    actor: "ai:dm",
    type: "proposal.created",
    visibility: "dm",
    payloadVersion: 1,
    payload: {
      proposalId: "prop-floor",
      policy: "ask",
      proposal: proposalExamples.floor,
    },
  };
  const view = selectPendingProposals([...dmApprovals.events, row], dm).find(
    (p) => p.proposalId === "prop-floor",
  );
  assert.ok(view);
  assert.equal(view.kind, "floor");
  assert.deepEqual(
    view.details.filter((d) => d.label !== "Rationale"),
    [
      { label: "Request", value: "End the turn" },
      { label: "Reason", value: proposalExamples.floor.reason },
      { label: "Visibility", value: "Everyone" },
    ],
  );
});

function withProposal(id, proposal) {
  const last = dmApprovals.events[dmApprovals.events.length - 1];
  const row = {
    ...last,
    seq: last.seq + 1,
    actor: "ai:dm",
    type: "proposal.created",
    visibility: "dm",
    payloadVersion: 1,
    payload: { proposalId: id, policy: "ask", proposal },
  };
  return selectPendingProposals([...dmApprovals.events, row], dm).find(
    (p) => p.proposalId === id,
  );
}

test("an action.suggest proposal renders a row per item and its read seq", () => {
  const view = withProposal("prop-sug", {
    kind: "action.suggest",
    summary: null,
    rationale: null,
    suggestion: {
      suggestionId: "sug-1",
      readSeq: 7,
      items: [
        {
          itemId: "i1",
          text: "Climb the wall",
          intent: {
            id: "sug-1.i1",
            kind: "attempt",
            actor: { kind: "pc", id: "ana" },
            params: { scope: "character" },
            targets: [],
            text: "climb the wall",
            source: "ai",
            commit: "declared",
          },
        },
      ],
    },
  });
  assert.ok(view);
  assert.deepEqual(
    view.details.map((d) => d.label),
    ["Read seq", "Item 1", "Item 1 as typed"],
  );
  assert.equal(view.details[0].value, "7");
  assert.equal(view.details[1].value, "Climb the wall — Action");
});

test("an action.accept proposal renders the suggestion and item ids", () => {
  const view = withProposal("prop-acc", {
    kind: "action.accept",
    summary: null,
    rationale: null,
    suggestionId: "sug-1",
    itemId: "i1",
  });
  assert.deepEqual(view.details, [
    { label: "Suggestion", value: "sug-1" },
    { label: "Item", value: "i1" },
  ]);
});
