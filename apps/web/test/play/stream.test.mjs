import assert from "node:assert/strict";
import { test } from "node:test";
import { project } from "@the-stacks/session-model";
import {
  fixtureIds,
  freeModeAction,
  turnModeCombat,
} from "@the-stacks/session-model/fixtures";
import { streamItems } from "../../app/play/stream.ts";

const dm = { role: "dm" };
const items = (f, viewer = dm) => {
  const p = project(f.events, viewer);
  return streamItems({ transcript: [] }, p, viewer);
};
const text = (i) =>
  i.kind === "roll" ? i.summary : i.kind === "rules" ? i.text : "";

test("a check is one row: actor, skill, total, tick and word", () => {
  const roll = items(freeModeAction).find((i) => i.kind === "roll");
  assert.match(roll.summary, /^Ana — .*18 ✓ success$/);
  assert.ok(roll.detail.join(" ").includes("vs DC"));
  assert.equal(roll.category, "rules");
});

test("an attack row names attacker, target and result; damage joins the detail", () => {
  const roll = items(turnModeCombat).find(
    (i) => i.kind === "roll" && i.summary.includes("vs"),
  );
  assert.equal(roll.summary, "Ana — Attack vs Goblin: hit");
  assert.ok(roll.detail.some((d) => d.includes("vs AC 12")));
});

test("a roll row precedes its batch's narration seq", () => {
  const p = project(freeModeAction.events, dm);
  const narr = p.transcript.find((t) => t.kind === "narration");
  const roll = items(freeModeAction).find((i) => i.kind === "roll");
  assert.ok(roll.seq < narr.seq);
});

test("mode words and both d20 faces with the dropped one marked", () => {
  const events = freeModeAction.events.map((e) => {
    if (e.type !== "dice.rolled") return e;
    const t = e.payload.event.terms[0];
    return {
      ...e,
      payload: {
        ...e.payload,
        event: {
          ...e.payload.event,
          mode: "advantage",
          terms: [
            { ...t, count: 2, faces: [13, 6], kept: [true, false] },
            ...e.payload.event.terms.slice(1),
          ],
        },
      },
    };
  });
  const p = project(events, dm);
  const roll = streamItems({ transcript: [] }, p, dm).find(
    (i) => i.kind === "roll",
  );
  assert.match(roll.summary, /with advantage/);
  assert.deepEqual(roll.dice[0].faces, [13, 6]);
  assert.deepEqual(roll.dice[0].kept, [true, false]);
  // The faces render once, from `dice`; the detail line repeats none of them.
  assert.ok(!/d20|\b13\b.*\b6\b/.test(roll.detail[0]));
  assert.match(roll.detail[0], /otal/);
});

test("a batch with no outcome shows the total only", () => {
  const events = freeModeAction.events.filter(
    (e) => e.type !== "check.resolved",
  );
  const p = project(events, dm);
  const roll = streamItems({ transcript: [] }, p, dm).find(
    (i) => i.kind === "roll",
  );
  assert.match(roll.summary, /18$/);
  assert.ok(!/✓|✗/.test(roll.summary));
});

test("parity: every status-strip and margin fact has a matching stream text", () => {
  const p = project(turnModeCombat.events, dm);
  const out = streamItems({ transcript: [] }, p, dm);
  const lines = out.filter((i) => i.kind === "rules").map(text);
  const init = lines.find((l) => l.startsWith("Initiative: "));
  for (const n of ["Ana", "Bram", "Goblin"]) assert.ok(init.includes(n));
  // Party HP changes and life state read as lines; the goblin's HP is not a party fact.
  assert.ok(!lines.some((l) => l.startsWith("Goblin: HP")));
  const room = streamItems(
    { transcript: [] },
    project(freeModeAction.events, dm),
    dm,
  ).find((i) => i.kind === "room");
  assert.equal(room.heading, "Undercroft");
  for (const m of project(freeModeAction.events, dm).party) {
    assert.ok(
      room.party.includes(
        `${m.name} HP ${m.combatant.hp.current}/${m.combatant.hp.max}`,
      ),
    );
  }
});

test("a party member's HP change reads as a rules line", () => {
  const events = turnModeCombat.events.map((e) => {
    if (e.type !== "hp.changed") return e;
    const ev = {
      ...e.payload.event,
      combatantId: "ana",
      before: { current: 9, temp: 0 },
      after: { current: 5, temp: 0 },
    };
    return { ...e, payload: { ...e.payload, event: ev } };
  });
  const p = project(events, dm);
  const lines = streamItems({ transcript: [] }, p, dm)
    .filter((i) => i.kind === "rules")
    .map(text);
  assert.ok(lines.includes("Ana: HP 9 → 5 (damage)."));
});

test("a dm-visibility ledger row yields no item for a player viewer", () => {
  const events = freeModeAction.events.map((e) =>
    e.type === "dice.rolled" || e.type === "check.resolved"
      ? { ...e, visibility: "dm" }
      : e,
  );
  const player = { role: "player", userId: fixtureIds.playerUserId };
  const asDm = streamItems({ transcript: [] }, project(events, dm), dm);
  const asPlayer = streamItems(
    { transcript: [] },
    project(events, player),
    player,
  );
  assert.ok(asDm.some((i) => i.kind === "roll"));
  assert.ok(!asPlayer.some((i) => i.kind === "roll"));
});

test("a settled narration's rules lines are Rules-category items after the prose (FR-009, FR-027)", () => {
  const narr = {
    kind: "narration",
    seq: 5,
    text: "The blade bites.\n\nState: Ana HP 9/9",
  };
  const p = project(freeModeAction.events, dm);
  const out = streamItems({ transcript: [{ seq: 5, ...narr }] }, p, dm);
  const r = out.find(
    (i) => i.kind === "rules" && i.text === "State: Ana HP 9/9",
  );
  assert.equal(r.category, "rules");
  assert.ok(r.seq > 5 && r.seq < 6);
});
