// TASK-0145 #1 and TASK-0147 #1-#4 as planner tests (spec 097 US3, formulation 3).
// Evidence: specs/034-narration-quality/evidence/verify-20261026T183818Z-greyhollow-ford-provider/
// (run 183818Z seq 260-265) and docs/design/m2-demo/demo-session/transcript.jsonl (M2 seq 296-304).
import { INTENT_KINDS } from "@the-stacks/intent";
import { VALID } from "@the-stacks/intent/fixtures";
import { describe, expect, it } from "vitest";
import { type PlanResult, type PlanState, plan } from "../src/index.js";
import {
  actors,
  baseState,
  intent,
  sansText,
  setActor,
  tgt,
  view,
  withCombatant,
} from "./fixtures.js";

const run = (i: ReturnType<typeof intent>, s: PlanState = baseState()) =>
  plan(s, view(s), i);

describe("TASK-0145 #1: no combat end by fiat (run 183818Z seq 260-265)", () => {
  it("ai:dm end_combat is refused while Snag stands, and allowed once Snag yielded", () => {
    const s = baseState();
    setActor(s, "goblin-2", { presence: "yielded" });
    const end = () => intent("end_combat", { actor: actors.aiDm });
    const r = run(end(), s);
    expect(r.kind === "refusal" && r.refusal.code).toBe("DM_SEAT_REQUIRED");
    setActor(s, "snag", { presence: "yielded" });
    const ok = run(end(), s);
    expect(ok.kind === "commands" && ok.commands[0]?.command.type).toBe(
      "encounter.end",
    );
  });
});

describe("TASK-0147 #1-#3 (M2 seq 296-304)", () => {
  it("#1 ai:dm frightened on a party character is refused; Kestrel's contest rolls against goblin-2", () => {
    const r = run(
      intent("apply_condition", {
        actor: actors.aiDm,
        targets: [tgt("kestrel")],
        params: { op: "add", condition: "frightened" },
      }),
    );
    expect(r.kind === "refusal" && r.refusal.code).toBe("DM_SEAT_REQUIRED");
    const c = run(
      intent("contest", {
        actor: actors.kestrel,
        targets: [tgt("goblin-2")],
        params: { skill: "intimidation" },
      }),
    );
    expect(c.kind === "commands" && c.commands[0]?.command).toMatchObject({
      type: "check.roll",
      opposition: { opponentId: "goblin-2", rule: "influence" },
    });
  });

  it("#2 a healing spell and a help assist on a willing ally plan no roll against the ally", () => {
    const heal = run(
      intent("cast", {
        actor: actors.companion,
        targets: [tgt("kestrel")],
        params: { spell: "cure-wounds" },
      }),
    );
    expect(heal.kind === "commands" && heal.commands[0]?.command.type).toBe(
      "spell.cast",
    );
    const help = run(
      intent("help", {
        targets: [tgt("kestrel")],
        params: { assist: { kind: "check", skill: "athletics" } },
      }),
    );
    expect(help.kind === "commands" && help.commands[0]?.command.type).toBe(
      "help.grant",
    );
  });

  it("#3 'I grab the clapper' asks for an outcome, and an accept plans no roll", () => {
    const a = intent("attempt", {
      id: "i-clapper",
      text: "I grab the clapper.",
    });
    const r = run(a);
    expect(r.kind).toBe("needs_ruling");
    if (r.kind !== "needs_ruling") return;
    const s = baseState({ openRequests: { "i-clapper": r.request } });
    const done = run(
      intent("ruling", {
        actor: actors.aiDm,
        params: { requestId: "i-clapper", decision: "accept" },
      }),
      s,
    );
    expect(done).toMatchObject({ kind: "commands", commands: [] });
  });
});

const SEAT = new Set(["pc", "companion"]);
const ROLLS = new Set(["attack.roll", "check.roll", "spell.cast"]);
const BENEFICIAL = new Set(["help.grant", "condition.remove"]);
const SELF_OR_SETUP = new Set([
  "combatant.add",
  "initiative.join",
  "movement.action",
  "turn.advance",
  "roll",
  "rest.short",
  "rest.long",
  "move",
]);

describe("TASK-0147 #4: formulation 3 over every served player-seat fixture", () => {
  const playerFixtures = INTENT_KINDS.flatMap((k) => VALID[k]).filter((i) =>
    SEAT.has(i.actor.kind),
  );

  it("every command that changes another actor is rolled, guarded or beneficial", () => {
    let planned = 0;
    for (const i of playerFixtures) {
      const s = baseState();
      for (const id of ["thorin", "kestrel", "mira", "goblin-2", "snag"]) {
        void id;
      }
      const r: PlanResult = plan(s, view(s), i);
      if (r.kind !== "commands") continue;
      planned += r.commands.length;
      const me = (i.actor as { id: string }).id;
      for (const pc of r.commands) {
        const cmd = pc.command as { type: string; targetId?: string };
        if (cmd.targetId === undefined || cmd.targetId === me) continue;
        const ok =
          ROLLS.has(cmd.type) ||
          BENEFICIAL.has(cmd.type) ||
          SELF_OR_SETUP.has(cmd.type) ||
          pc.when !== undefined;
        expect(ok, `${i.kind}: ${cmd.type} on ${cmd.targetId}`).toBe(true);
      }
    }
    expect(planned).toBeGreaterThan(0);
  });

  it("changing the text changes nothing", () => {
    for (const i of playerFixtures) {
      const s = baseState();
      const a = plan(s, view(s), i);
      const b = plan(s, view(s), { ...i, text: "something else entirely" });
      expect(sansText(b), i.kind).toEqual(sansText(a));
    }
    void withCombatant;
  });
});
