import assert from "node:assert/strict";
import { test } from "node:test";
import { commitAuthorityFor } from "../../app/play/authority.ts";

const ANA = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-000000000002";
const party = [
  {
    characterId: "ana",
    name: "Ana",
    controller: { kind: "player", userId: ANA },
    combatantId: "ana",
    combatant: null,
  },
  {
    characterId: "bram",
    name: "Bram",
    controller: { kind: "ai-companion", actor: "ai:companion:bram" },
    combatantId: "bram",
    combatant: null,
  },
];
const action = (over = {}) => ({
  actionId: "act-1",
  declaredSeq: 1,
  actor: ANA,
  characterId: "ana",
  scope: "character",
  text: "Ana picks the lock.",
  status: "declared",
  comments: [],
  committed: null,
  resolved: null,
  ...over,
});
const free = { mode: "free" };
const turn = (activeActor) => ({
  mode: "turn",
  activeActor,
  activeCharacterId: null,
});
const player = (userId) => ({ role: "player", userId });
const dm = { role: "dm" };

test("free mode: the declarer commits as declarer", () => {
  assert.deepEqual(commitAuthorityFor(action(), free, player(ANA), party), {
    canCommit: true,
    authority: "declarer",
  });
});

test("free mode: another player cannot commit; holder is the declarer", () => {
  assert.deepEqual(commitAuthorityFor(action(), free, player(OTHER), party), {
    canCommit: false,
    holder: ANA,
  });
});

test("turn mode: the active player commits their own action", () => {
  assert.deepEqual(
    commitAuthorityFor(action(), turn(ANA), player(ANA), party),
    { canCommit: true, authority: "active-player" },
  );
});

test("turn mode: a non-active player cannot commit; holder is the active actor", () => {
  assert.deepEqual(
    commitAuthorityFor(
      action({ actor: OTHER }),
      turn(ANA),
      player(OTHER),
      party,
    ),
    { canCommit: false, holder: ANA },
  );
});

test("turn mode: the active player cannot commit another actor's action", () => {
  assert.deepEqual(
    commitAuthorityFor(
      action({ actor: "ai:companion:bram", characterId: "bram" }),
      turn(ANA),
      player(ANA),
      party,
    ),
    { canCommit: false, holder: ANA },
  );
});

test("the DM commits as dm in both modes", () => {
  for (const mode of [free, turn(ANA)]) {
    assert.deepEqual(commitAuthorityFor(action(), mode, dm, party), {
      canCommit: true,
      authority: "dm",
    });
  }
});

test("party scope: a player controlling a member commits as group", () => {
  const a = action({ scope: "party", characterId: null, actor: OTHER });
  assert.deepEqual(commitAuthorityFor(a, free, player(ANA), party), {
    canCommit: true,
    authority: "group",
  });
});

test("party scope: a player controlling no member gets no group control", () => {
  const a = action({ scope: "party", characterId: null, actor: ANA });
  assert.deepEqual(commitAuthorityFor(a, free, player(OTHER), party), {
    canCommit: false,
    holder: ANA,
  });
});

test("committed and resolved actions have no control and no holder", () => {
  for (const status of ["committed", "resolved"]) {
    for (const viewer of [dm, player(ANA)]) {
      assert.deepEqual(
        commitAuthorityFor(action({ status }), free, viewer, party),
        { canCommit: false, holder: null },
      );
    }
  }
});

test("a discussed action is still open to commit", () => {
  assert.equal(
    commitAuthorityFor(
      action({ status: "discussed" }),
      free,
      player(ANA),
      party,
    ).canCommit,
    true,
  );
});

const CLEO_PARTY = [
  ...party,
  {
    characterId: "cleo",
    name: "Cleo",
    controller: { kind: "player", userId: OTHER },
    combatantId: "cleo",
    combatant: null,
  },
];
const groupAction = (over = {}) =>
  action({ scope: "party", characterId: null, actor: ANA, ...over });

test("sign-off: with the present set, the commit control waits for the quorum", () => {
  const present = [ANA, OTHER];
  assert.deepEqual(
    commitAuthorityFor(groupAction(), free, player(ANA), CLEO_PARTY, present),
    { canCommit: false, holder: null },
  );
});

test("sign-off: the control appears once the other present human approved", () => {
  const a = groupAction({
    comments: [{ seq: 5, actor: OTHER, stance: "approve", text: "", ts: "t" }],
  });
  assert.deepEqual(
    commitAuthorityFor(a, free, player(ANA), CLEO_PARTY, [ANA, OTHER]),
    { canCommit: true, authority: "group" },
  );
});

test("sign-off: an objection blocks the control", () => {
  const a = groupAction({
    comments: [{ seq: 5, actor: OTHER, stance: "object", text: "no", ts: "t" }],
  });
  assert.equal(
    commitAuthorityFor(a, free, player(ANA), CLEO_PARTY, [ANA, OTHER])
      .canCommit,
    false,
  );
});
