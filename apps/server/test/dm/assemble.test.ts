import { estimateTokens } from "@the-stacks/srd";
import { describe, expect, it } from "vitest";
import { assemble } from "../../src/dm/nodes/assemble.js";
import { CAPS } from "../../src/dm/prompts/common.js";
import {
  buildDirectorPrompt,
  PROMPT_VERSION as DIRECTOR_VERSION,
} from "../../src/dm/prompts/director.js";
import { buildSnapshot } from "../../src/dm/snapshot/index.js";
import {
  commit,
  declare,
  fixtureEvents,
  freeEventsThrough,
  makeCtx,
  projectDm,
  row,
  testSeed,
} from "./helpers.js";

async function run(
  events: ReturnType<typeof freeEventsThrough>,
  over: Parameters<typeof makeCtx>[0] = {},
) {
  const ctx = makeCtx({
    ...over,
    deps: { loadProjections: async () => projectDm(events), ...over.deps },
  });
  const result = await assemble(ctx);
  if (!result.ok) throw new Error("assemble failed");
  return { ctx, output: result.output };
}

describe("assemble", () => {
  it("includes a committed action as a committed beat item", async () => {
    const { output } = await run(freeEventsThrough("action.committed"));
    expect(output.beat).toHaveLength(1);
    expect(output.beat[0]).toMatchObject({
      actionId: "act-lockpick",
      status: "committed",
      characterId: "ana",
    });
    expect(output.throughSeq).toBe(output.projections.throughSeq);
  });

  it("includes a resolved-but-unnarrated action (FR-004)", async () => {
    const { output } = await run(freeEventsThrough("action.resolved"));
    expect(output.beat.map((b) => [b.actionId, b.status])).toEqual([
      ["act-lockpick", "resolved"],
    ]);
  });

  it("excludes a resolved action that has a narration row", async () => {
    const { output } = await run(freeEventsThrough("narration"));
    expect(output.beat).toEqual([]);
    expect(output.npcTurn).toBeNull();
  });

  it("excludes a resolved action named by a pending narration proposal", async () => {
    const events = freeEventsThrough("action.resolved");
    const next = events.length + 1;
    events.push(
      row(
        next,
        "ai:dm",
        "proposal.created",
        {
          proposalId: "prop-n",
          policy: "ask",
          proposal: {
            kind: "narration",
            narration: {
              text: "The door swings.",
              actionIds: ["act-lockpick"],
            },
          },
        },
        "dm",
      ),
    );
    const { output } = await run(events);
    expect(output.beat).toEqual([]);
  });

  it("orders the beat by commit seq, not declare seq", async () => {
    const base = freeEventsThrough("narration");
    const n = base.length;
    const events = [
      ...base,
      declare(n + 1, "act-a", "ana", "Ana looks left."),
      declare(n + 2, "act-b", "bram", "Bram looks right."),
      commit(n + 3, "act-b"),
      commit(n + 4, "act-a"),
    ];
    const { output } = await run(events);
    expect(output.beat.map((b) => b.actionId)).toEqual(["act-b", "act-a"]);
    expect(output.beat.map((b) => b.committedSeq)).toEqual([n + 3, n + 4]);
  });

  it("freezes the beat on a later attempt (FR-004)", async () => {
    const base = freeEventsThrough("narration");
    const n = base.length;
    const events = [
      ...base,
      declare(n + 1, "act-a", "ana", "Ana looks left."),
      commit(n + 2, "act-a"),
      declare(n + 3, "act-late", "bram", "Bram shouts."),
      commit(n + 4, "act-late"),
    ];
    const { output } = await run(events, {
      job: { attempt: 2 },
      checkpoint: { beat: ["act-a"] },
    });
    expect(output.beat.map((b) => b.actionId)).toEqual(["act-a"]);
  });

  it("skips an action with two rejected proposals", async () => {
    const base = freeEventsThrough("narration");
    let n = base.length;
    const events = [
      ...base,
      declare(++n, "act-a", "ana", "Ana looks left."),
      commit(++n, "act-a"),
    ];
    for (const id of ["p1", "p2"]) {
      events.push(
        row(
          ++n,
          "ai:dm",
          "proposal.created",
          {
            proposalId: id,
            policy: "ask",
            proposal: {
              kind: "action.resolve",
              resolution: {
                actionId: "act-a",
                outcome: "no-effect",
                batchIds: [],
                refusalCode: null,
              },
            },
          },
          "dm",
        ),
        row(
          ++n,
          "00000000-0000-4000-8000-000000000003",
          "proposal.rejected",
          {
            proposalId: id,
            reason: "no",
          },
          "dm",
        ),
      );
    }
    const { output } = await run(events);
    expect(output.rejections["act-a"]).toBe(2);
    expect(output.beat).toEqual([]);
  });

  it("derives an NPC turn from state, whatever the trigger", async () => {
    const events = fixtureEvents("turn-mode-combat").slice(0, 20);
    const projections = projectDm(events);
    const modified = {
      ...projections,
      tableMode: {
        mode: "turn" as const,
        activeActor: "ai:dm",
        activeCharacterId: null,
      },
      encounter: projections.encounter
        ? { ...projections.encounter, activeCombatantId: "goblin" }
        : null,
    };
    const seed = testSeed();
    const customSeed = {
      ...seed,
      encounters: seed.encounters.map((e, i) =>
        i === 0
          ? {
              ...e,
              monsters: [
                {
                  combatantId: "goblin",
                  srdMonsterId: "goblin-warrior",
                  name: "Goblin",
                },
              ],
            }
          : e,
      ),
    };
    for (const trigger of ["commit", "npc-turn", "manual"] as const) {
      const ctx = makeCtx({
        seed: customSeed,
        job: { trigger },
        deps: { loadProjections: async () => modified },
      });
      const result = await assemble(ctx);
      if (!result.ok) throw new Error("assemble failed");
      expect(result.output.npcTurn).toEqual({
        combatantId: "goblin",
        srdMonsterId: "goblin-warrior",
      });
      expect(result.output.activeEncounterId).toBe(
        customSeed.encounters[0]?.id,
      );
      expect(result.output.srdRecords.map((r) => r.id)).toContain(
        "goblin-warrior",
      );
    }
  });

  it("derives no NPC turn when a player is active", async () => {
    const { output } = await run(
      fixtureEvents("turn-mode-combat").slice(0, 12),
    );
    expect(output.npcTurn).toBeNull();
  });

  it("selects SRD records by name from the beat, within the cap", async () => {
    const base = freeEventsThrough("narration");
    const n = base.length;
    const events = [
      ...base,
      declare(n + 1, "act-a", "ana", "Ana casts Fireball and then Shield."),
      commit(n + 2, "act-a"),
    ];
    const { output } = await run(events);
    const ids = output.srdRecords.map((r) => `${r.kind}/${r.id}`);
    expect(ids).toContain("spell/fireball");
    expect(output.srdRecords.length).toBeLessThanOrEqual(CAPS.srdRecords);
    for (const r of output.srdRecords) {
      expect(r.compact.length).toBeGreaterThan(0);
    }
  });

  it("gathers prior steps for a beat action", async () => {
    const events = freeEventsThrough("action.committed");
    const full = fixtureEvents("free-mode-action");
    const withRolls = full.slice(
      0,
      full.findIndex((e) => e.type === "action.resolved"),
    );
    const { output } = await run(withRolls);
    expect(output.priorSteps["act-lockpick"]?.length).toBeGreaterThan(0);
    expect(events.length).toBeLessThan(withRolls.length);
  });

  it("keeps the transcript tail to 20 entries", async () => {
    const base = freeEventsThrough("narration");
    let n = base.length;
    const events = [...base];
    for (let i = 0; i < 30; i++) {
      events.push(
        row(++n, "00000000-0000-4000-8000-000000000001", "talk", {
          text: `line ${i}`,
          channel: "ic",
          characterId: "ana",
        }),
      );
    }
    const { output } = await run(events);
    expect(output.transcriptTail).toHaveLength(20);
  });
});

describe("assemble: S0", () => {
  it("builds the actor snapshot from the projections and the seed", async () => {
    const events = freeEventsThrough("action.committed");
    const { ctx, output } = await run(events);
    expect(output.snapshot).toEqual(buildSnapshot(projectDm(events), ctx.seed));
    expect(output.snapshot.throughSeq).toBe(output.throughSeq);
    expect(output.snapshot.actors.length).toBeGreaterThan(0);
  });

  it("renders the director State section from S0 with tracker lines", async () => {
    const { ctx, output } = await run(freeEventsThrough("action.committed"));
    const prompt = buildDirectorPrompt({
      ctx,
      assembled: output,
      aiCompanions: [],
      runnableEncounterIds: [],
    });
    const state = /## State\n([\s\S]*?)(\n\n##|$)/.exec(prompt.user);
    expect(state?.[1]).toContain("Table mode: free");
    for (const a of output.snapshot.actors) {
      expect(state?.[1]).toContain(`"${a.name}"`);
    }
    for (const t of output.snapshot.stage.trackers) {
      expect(state?.[1]).toContain(t.trackerId);
    }
  });
});

describe("prompt caps (SC-007)", () => {
  it("cuts whole entries and keeps each part under its cap", async () => {
    const base = freeEventsThrough("narration");
    let n = base.length;
    const events = [...base];
    for (let i = 0; i < 25; i++) {
      events.push(
        row(++n, "00000000-0000-4000-8000-000000000001", "talk", {
          text: `${"The river rises past the old ferry stones. ".repeat(12)}${i}`,
          channel: "ic",
          characterId: "ana",
        }),
      );
    }
    const { ctx, output } = await run(events);
    const prompt = buildDirectorPrompt({
      ctx,
      assembled: output,
      aiCompanions: [],
      runnableEncounterIds: [],
    });
    expect(DIRECTOR_VERSION).toBe("dm.director-v3");
    const transcript = /## Recent transcript\n([\s\S]*?)(\n\n##|$)/.exec(
      prompt.user,
    );
    expect(transcript).not.toBeNull();
    expect(estimateTokens(transcript?.[1] ?? "")).toBeLessThanOrEqual(
      CAPS.transcript,
    );
    // Oldest entries went first: the newest line survives.
    const said = (transcript?.[1] ?? "")
      .split("\n")
      .filter((l) => l.includes(" said: "));
    expect(said.length).toBeGreaterThan(0);
    expect(said.length).toBeLessThan(20);
    expect(said[said.length - 1]).toContain("24");
    expect(said[0]).not.toContain("stones. 0");
    // Doctrine block stays under its cap.
    const doctrine =
      prompt.system.split("Doctrine:")[1]?.split("Reply with")[0] ?? "";
    expect(estimateTokens(doctrine)).toBeLessThanOrEqual(CAPS.doctrine);
  });

  describe("presence (decision-0024)", () => {
    const ANA = "00000000-0000-4000-8000-000000000001";
    const OTHER = "00000000-0000-4000-8000-000000000002";

    function withMarker(present: string[]) {
      const events = freeEventsThrough("action.committed");
      const seq = events.length + 1;
      return [
        ...events,
        row(seq, "system", "presence.recorded", {
          present,
          purpose: "director",
        }),
      ];
    }

    it("splits present from absent human controllers using the folded marker", async () => {
      const { output } = await run(withMarker([OTHER]));
      expect(output.presence).toEqual({
        present: [OTHER],
        absent: [ANA],
        seq: output.projections.presence?.seq,
      });
    });

    it("lists no absent controller when every controller is present", async () => {
      const { output } = await run(withMarker([ANA]));
      expect(output.presence?.present).toEqual([ANA]);
      expect(output.presence?.absent).toEqual([]);
    });

    it("is null when no marker was folded", async () => {
      const { output } = await run(freeEventsThrough("action.committed"));
      expect(output.presence).toBeNull();
    });
  });

  it("lists only NPCs that are not absent, in seed order (spec 050)", async () => {
    const events = freeEventsThrough("action.resolved");
    const gone = (seq: number, actorId: string) =>
      row(seq, "ai:dm", "scene-presence.changed", {
        actorId,
        before: "present",
        after: "absent",
        reason: "removed",
        actionId: null,
      });
    const base = events.length;
    const none = await run(events);
    expect(none.output.presentNpcIds).toEqual(["wenna", "pell", "snag"]);
    const { output } = await run([
      ...events,
      gone(base + 1, "pell"),
      gone(base + 2, "snag"),
    ]);
    expect(output.presentNpcIds).toEqual(["wenna"]);
  });
});
