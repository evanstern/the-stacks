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

test("each pending proposal carries its recorded policy", () => {
  const list = selectPendingProposals(dmApprovals.events, dm);
  assert.deepEqual(
    list.map((p) => p.policy),
    ["suggest", "ask", "ask"],
  );
});
