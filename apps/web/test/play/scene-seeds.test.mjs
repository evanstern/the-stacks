import assert from "node:assert/strict";
import { test } from "node:test";
import { project } from "@the-stacks/session-model";
import { dmApprovals, fixtureIds } from "@the-stacks/session-model/fixtures";
import { selectPendingProposals } from "../../app/play/proposals.ts";
import { sceneChangeView } from "../../app/play/scene-seeds.ts";

const dm = dmApprovals.viewers.dm;
const base = dmApprovals.events;
const lastSeq = base[base.length - 1].seq;

/** A `proposal.created` row for a scene proposal. */
function sceneRow(seq, id, over = {}) {
  const { proposer = fixtureIds.dmActor, policy = "suggest" } = over;
  const after =
    "after" in over
      ? over.after
      : {
          sceneId: `scene-${id}`,
          title: `Scene ${id}`,
          summary: `Summary ${id}`,
          location: null,
        };
  return {
    sessionId: dmApprovals.sessionId,
    seq,
    actor: proposer,
    type: "proposal.created",
    payload: {
      proposalId: id,
      policy,
      proposal: {
        kind: "scene",
        summary: `Go to ${id}`,
        rationale: "A test rationale.",
        reason: `Reason ${id}`,
        after,
      },
    },
    payloadVersion: 1,
    visibility: "dm",
    ts: `2026-10-26T19:00:${String(seq % 60).padStart(2, "0")}.000Z`,
  };
}

const viewOf = (events, pendingIds) =>
  sceneChangeView(project(events, dm), new Set(pendingIds));
const pendingOf = (events) =>
  selectPendingProposals(events, dm).map((p) => p.proposalId);

test("P3 is the one pending seed with its scene and reason", () => {
  const v = viewOf(base, pendingOf(base));
  assert.equal(v.pending.length, 1);
  const [seed] = v.pending;
  assert.equal(seed.proposalId, "prop-3");
  assert.equal(seed.origin, "pending");
  assert.equal(seed.policy, "suggest");
  assert.equal(seed.label, "Move the party into the vault");
  assert.equal(seed.reason, "The party steps through the open door");
  assert.equal(seed.clear, false);
  assert.deepEqual(seed.scene, {
    sceneId: "vault-interior",
    title: "Inside the vault",
    summary: "Shelves of dusty crates line a low stone room.",
    location: "Undercroft",
  });
  assert.deepEqual(v.earlier, []);
  assert.equal(v.empty, false);
});

test("current is the vault-door scene with an empty reason", () => {
  const v = viewOf(base, pendingOf(base));
  assert.equal(v.current.origin, "current");
  assert.equal(v.current.key, "current");
  assert.equal(v.current.proposalId, null);
  assert.equal(v.current.policy, null);
  assert.equal(v.current.label, "Current scene");
  assert.equal(v.current.reason, "");
  assert.equal(v.current.scene.sceneId, "vault-door");
  assert.equal(v.current.scene.title, "The vault door");
});

test("with P3 not pending it moves to earlier (fixture-mode decided case)", () => {
  const v = viewOf(base, []);
  assert.deepEqual(v.pending, []);
  assert.equal(v.earlier.length, 1);
  assert.equal(v.earlier[0].proposalId, "prop-3");
  assert.equal(v.earlier[0].origin, "earlier");
});

test("an ask scene proposal from ai:dm is a seed (D-4)", () => {
  const events = [...base, sceneRow(lastSeq + 1, "ask-1", { policy: "ask" })];
  const v = viewOf(events, ["prop-3", "ask-1"]);
  const seed = v.pending.find((s) => s.proposalId === "ask-1");
  assert.ok(seed);
  assert.equal(seed.policy, "ask");
  assert.deepEqual(
    v.pending.map((s) => s.proposalId),
    ["prop-3", "ask-1"],
  );
});

test("a scene proposal from a non-ai:dm proposer is not a seed", () => {
  const events = [
    ...base,
    sceneRow(lastSeq + 1, "human-1", { proposer: fixtureIds.companionActor }),
  ];
  const v = viewOf(events, ["prop-3", "human-1"]);
  assert.ok(
    ![...v.pending, ...v.earlier].some((s) => s.proposalId === "human-1"),
  );
});

test("with twelve scene proposals only the last ten appear", () => {
  const rows = [];
  for (let i = 0; i < 12; i++) {
    rows.push(sceneRow(lastSeq + 1 + i, `many-${i}`));
  }
  const events = [...base, ...rows];
  const v = viewOf(events, []);
  const all = [...v.pending, ...v.earlier];
  assert.equal(all.length, 10);
  assert.deepEqual(
    v.earlier.map((s) => s.proposalId),
    [11, 10, 9, 8, 7, 6, 5, 4, 3, 2].map((i) => `many-${i}`),
  );
});

test("a clear seed is dropped when there is no scene", () => {
  const clearRow = sceneRow(lastSeq + 1, "clear-1", { after: null });
  const withScene = viewOf([...base, clearRow], ["clear-1"]);
  const clear = withScene.pending.find((s) => s.proposalId === "clear-1");
  assert.ok(clear);
  assert.equal(clear.clear, true);
  assert.equal(clear.scene, null);
  // Clear the scene first: a scene.changed row with after null.
  const cleared = {
    sessionId: dmApprovals.sessionId,
    seq: lastSeq + 1,
    actor: fixtureIds.dmUserId,
    type: "scene.changed",
    payload: {
      reason: "End the scene",
      before: {
        sceneId: "vault-door",
        title: "The vault door",
        summary:
          "A heavy iron door blocks the undercroft vault. Its lock is old but sound.",
        location: "Undercroft",
      },
      after: null,
    },
    payloadVersion: 1,
    visibility: "public",
    ts: "2026-10-26T19:00:00.000Z",
  };
  const events = [
    ...base,
    cleared,
    sceneRow(lastSeq + 2, "clear-2", { after: null }),
  ];
  const p = project(events, dm);
  assert.equal(p.scene, null);
  const v = sceneChangeView(p, new Set(["clear-2"]));
  assert.ok(
    ![...v.pending, ...v.earlier].some((s) => s.proposalId === "clear-2"),
  );
  assert.equal(v.current, null);
});

test("turnMode follows the table mode", () => {
  assert.equal(viewOf(base, []).turnMode, false);
  const turn = {
    sessionId: dmApprovals.sessionId,
    seq: lastSeq + 1,
    actor: fixtureIds.dmUserId,
    type: "table-mode.changed",
    payload: {
      reason: "Guards arrive",
      before: { mode: "free" },
      after: {
        mode: "turn",
        activeActor: fixtureIds.playerUserId,
        activeCharacterId: "ana",
      },
    },
    payloadVersion: 1,
    visibility: "public",
    ts: "2026-10-26T19:00:00.000Z",
  };
  assert.equal(viewOf([...base, turn], []).turnMode, true);
});

test("empty is true with no scene and no scene proposal", () => {
  const noScene = base.filter(
    (e) => e.type !== "scene.changed" && e.type !== "proposal.created",
  );
  // Drop proposal rows' decisions too so the log stays coherent.
  const events = noScene.filter(
    (e) => e.type !== "proposal.approved" && e.type !== "proposal.rejected",
  );
  const v = viewOf(events, []);
  assert.equal(v.current, null);
  assert.equal(v.empty, true);
  assert.equal(viewOf(base, pendingOf(base)).empty, false);
});
