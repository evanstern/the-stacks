import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { StoredEvent } from "@the-stacks/session-model";
import { describe, expect, it } from "vitest";
import {
  buildNarrationFacts,
  type NarrationFacts,
} from "../../src/dm/facts.js";
import type { DirectorNodeOutput } from "../../src/dm/nodes/director.js";
import type { ResolveOutput } from "../../src/dm/nodes/resolve.js";
import { rosterOf } from "../../src/dm/prompts/common.js";
import { buildCompanionPrompt } from "../../src/dm/prompts/companion.js";
import { buildNarratePrompt } from "../../src/dm/prompts/narrate.js";
import { dmOnlySeedText, playerFacingSeed } from "../../src/dm/seed/views.js";
import { projectDm, row, testSeed } from "./helpers.js";

/**
 * TASK-0106 card AC #1 (contracts/player-facing-context.md "Tests"): no
 * player-facing prompt holds a DM-only seed fact, a dm-visibility transcript
 * line, or a seat's user id. Over the Greyhollow Ford seed and run 5's rows.
 */

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(here, "fixtures/run5-narration-quality.json"), "utf8"),
) as { transcript: StoredEvent[] };

const SEED = testSeed();
const VIEW = playerFacingSeed(SEED);
const MARKER = "MARKER-dm-only-whisper-7731";

const projections = projectDm([
  ...fixture.transcript.filter((r) => r.seq <= 87),
  row(
    88,
    "ai:dm",
    "talk",
    { text: MARKER, channel: "ic", characterId: null },
    "dm",
  ),
]);
const humanSeat = projections.party.find((m) => m.controller.kind === "player");
const USER_ID =
  humanSeat?.controller.kind === "player" ? humanSeat.controller.userId : "";

const director = (beatId: string | null): DirectorNodeOutput => ({
  beat: { decision: "resolve" },
  tableMode: { to: "stay" },
  trackers: [],
  scene: { status: "continue" },
  pacing: { tension: "low", spotlight: null, beatId },
  goalNote: "",
  companionPrompts: [],
  overrides: [],
});

const noResolve = (over: Partial<ResolveOutput> = {}): ResolveOutput => ({
  submissions: [],
  actionResults: [],
  appendedRows: [],
  nextJob: null,
  chronicle: false,
  npcTurn: null,
  lastSeq: 0,
  ...over,
});

function facts(opts: {
  trigger: "scene-start" | "commit" | "npc-turn";
  beatId: string | null;
  beatNpcIds: string[];
  action?: boolean;
  npcTurn?: boolean;
  clarify?: { actionId: string; question: string }[];
}): NarrationFacts {
  return buildNarrationFacts({
    trigger: opts.trigger,
    seed: VIEW,
    beatNpcIds: opts.beatNpcIds,
    projections,
    beat: opts.action
      ? [
          {
            actionId: "act-x",
            committedSeq: 0,
            actor: USER_ID,
            characterId: "tamsin",
            scope: "character",
            text: "I ask Wenna about the bell.",
            status: "resolved",
          },
        ]
      : [],
    director: director(opts.beatId),
    adjudicate: null,
    resolve: noResolve({
      actionResults: opts.action
        ? [
            {
              actionId: "act-x",
              outcome: "no-effect",
              batchIds: [],
              refusalCode: null,
            },
          ]
        : [],
      npcTurn: opts.npcTurn
        ? { combatantId: "snag", batchIds: [], awaitingDm: false }
        : null,
    }),
    presentNpcIds: [],
    modeBefore: "free",
    appendedRows: [],
    clarify: opts.clarify ?? [],
  });
}

const assembled = {
  transcriptTail: projections.transcript,
  presentNpcIds: [],
  projections,
} as unknown as Parameters<typeof buildNarratePrompt>[0]["assembled"];

function narrate(f: NarrationFacts, prior = null as never) {
  return buildNarratePrompt({
    seed: VIEW,
    roster: rosterOf(projections.party),
    assembled,
    facts: f,
    prior,
  });
}

const clarifyFacts = facts({
  trigger: "commit",
  beatId: "the-keeper",
  beatNpcIds: ["wenna"],
  action: true,
  clarify: [{ actionId: "act-x", question: "Which way do you press on?" }],
});

const prompts: { name: string; text: string }[] = [];
const add = (name: string, p: { system: string; user: string }) =>
  prompts.push({ name, text: `${p.system}\n${p.user}` });

add(
  "narrate scene start",
  narrate(
    facts({
      trigger: "scene-start",
      beatId: "ferry-house",
      beatNpcIds: [],
    }),
  ),
);
add(
  "narrate the-keeper action",
  narrate(
    facts({
      trigger: "commit",
      beatId: "the-keeper",
      beatNpcIds: ["wenna"],
      action: true,
    }),
  ),
);
add(
  "narrate reed-camp npc turn",
  narrate(
    facts({
      trigger: "npc-turn",
      beatId: "reed-camp",
      beatNpcIds: ["snag", "pell"],
      npcTurn: true,
    }),
  ),
);
add("narrate clarify", narrate(clarifyFacts));
add(
  "narrate regenerate",
  narrate(clarifyFacts, {
    prose: "Too long.",
    issues: [{ kind: "doctrine", detail: "Over the word limit." }],
  } as never),
);
for (const id of ["odo", "kestrel"]) {
  for (const active of [true, false]) {
    add(
      `companion ${id} active=${active}`,
      buildCompanionPrompt({
        seed: VIEW,
        projections,
        characterId: id,
        active,
      }),
    );
  }
}

describe("player-facing prompts (card AC #1)", () => {
  it("builds every variant", () => {
    expect(prompts).toHaveLength(9);
    expect(USER_ID).not.toBe("");
  });

  it("holds no DM-only seed text", () => {
    const secrets = dmOnlySeedText(SEED);
    expect(secrets.length).toBeGreaterThan(10);
    for (const p of prompts) {
      for (const s of secrets) {
        expect(p.text, `${p.name} leaks: ${s}`).not.toContain(s);
      }
    }
  });

  it("holds no river-things or ward wording", () => {
    for (const p of prompts) {
      expect(p.text, p.name).not.toMatch(/river[- ]things?/i);
      expect(p.text, p.name).not.toMatch(/\bwards?\b/i);
    }
  });

  it("holds no dm-visibility line and no user id", () => {
    for (const p of prompts) {
      expect(p.text, p.name).not.toContain(MARKER);
      expect(p.text, p.name).not.toContain(USER_ID);
    }
  });

  it("gives each companion its own knows and not the other's", () => {
    const own = (id: string) =>
      VIEW.characters.find((c) => c.characterId === id);
    for (const [id, other] of [
      ["odo", "kestrel"],
      ["kestrel", "odo"],
    ] as const) {
      for (const active of [true, false]) {
        const p = buildCompanionPrompt({
          seed: VIEW,
          projections,
          characterId: id,
          active,
        });
        for (const k of own(id)?.knows ?? []) expect(p.user).toContain(k);
        for (const k of own(other)?.knows ?? [])
          expect(p.user).not.toContain(k);
      }
    }
  });
});
