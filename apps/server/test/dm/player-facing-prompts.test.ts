import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { StoredEvent } from "@the-stacks/session-model";
import { describe, expect, it } from "vitest";
import { buildFactSheet } from "../../src/dm/fact-sheet.js";
import {
  buildNarrationFacts,
  type NarrationFacts,
} from "../../src/dm/facts.js";
import type { DirectorNodeOutput } from "../../src/dm/nodes/director.js";
import type { ResolveOutput } from "../../src/dm/nodes/resolve.js";
import { buildAuditPrompt } from "../../src/dm/prompts/audit.js";
import { buildChroniclePrompt } from "../../src/dm/prompts/chronicle.js";
import { rosterOf } from "../../src/dm/prompts/common.js";
import { buildCompanionPrompt } from "../../src/dm/prompts/companion.js";
import { buildNarratePrompt } from "../../src/dm/prompts/narrate.js";
import { buildReactPrompt } from "../../src/dm/prompts/react.js";
import { dmOnlySeedText, playerFacingSeed } from "../../src/dm/seed/views.js";
import { buildSnapshot } from "../../src/dm/snapshot/index.js";
import { projectDm, row, testSeed } from "./helpers.js";
import { EMPTY_RESOLVE_SNAPSHOT } from "./snapshot-fixtures.js";

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
  ...EMPTY_RESOLVE_SNAPSHOT,
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

const snapshot = buildSnapshot(projections, SEED);

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
    snapshot,
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

const reactInput = () => ({
  seed: VIEW,
  roster: rosterOf(projections.party),
  snapshot,
  posts: [],
  triggers: [],
  transcriptTail: [],
  presentNpcIds: [],
  encounterIds: [],
  reachesCap: false,
  prior: null,
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
add(
  "audit with the snapshot sections",
  buildAuditPrompt({
    facts: facts({
      trigger: "commit",
      beatId: "the-keeper",
      beatNpcIds: ["wenna"],
      action: true,
    }),
    snapshot,
    prose: "Wenna watches the ford.",
  }),
);
add(
  "chronicle with the snapshot section",
  buildChroniclePrompt({
    snapshot,
    transcript: projections.transcript,
    goal: "",
    trackerNames: [],
    roster: rosterOf(projections.party),
  }),
);
const reactPosts = projections.transcript.filter(
  (e): e is Extract<typeof e, { kind: "talk" }> => e.kind === "talk",
);
for (const reachesCap of [false, true]) {
  add(
    `react cap=${reachesCap}`,
    buildReactPrompt({
      seed: VIEW,
      roster: rosterOf(projections.party),
      snapshot,
      posts: reactPosts.slice(-2),
      triggers: [{ kind: "addressed", actorId: "wenna", party: false }],
      transcriptTail: projections.transcript,
      presentNpcIds: ["wenna"],
      encounterIds: ["reed-camp"],
      reachesCap,
      prior: null,
    }),
  );
}
for (const id of ["odo", "kestrel"]) {
  for (const active of [true, false]) {
    add(
      `companion ${id} active=${active}`,
      buildCompanionPrompt({
        seed: VIEW,
        projections,
        snapshot,
        characterId: id,
        active,
      }),
    );
  }
}

describe("player-facing prompts (card AC #1)", () => {
  it("builds every variant", () => {
    expect(prompts).toHaveLength(13);
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

  it("a success carries only the named clue to narrate, no other DM-only seed text (spec 080)", () => {
    const base = facts({
      trigger: "commit",
      beatId: "ferry-house",
      beatNpcIds: [],
      action: true,
    });
    const [clue1, clue2] =
      SEED.beats.find((b) => b.id === "ferry-house")?.clues ?? [];
    const withRoll = (revealed: string | null): NarrationFacts => ({
      ...base,
      actions: base.actions.map((a) => ({
        ...a,
        rolls: [
          {
            name: "Tamsin",
            reason: "Tamsin looks for what made the marks",
            expression: "1d20+3",
            shown: "20",
            total: 23,
            against: { kind: "DC" as const, value: 12 },
            outcome: "success" as const,
            autoFail: false,
            target: null,
            band: "success" as const,
            margin: 11,
            consequence: "Tamsin reads the prints.",
            revealed,
          },
        ],
      })),
    });
    const p = narrate(withRoll(clue1?.text ?? null));
    const text = `${p.system}\n${p.user}`;
    expect(text).toContain(`learned (settled): ${clue1?.text}`);
    expect(text).not.toContain(clue2?.text ?? "unreachable");
    // The named clue is DM-only seed text too; it is the one entry allowed through.
    for (const secret of dmOnlySeedText(SEED)) {
      if (clue1 && secret.includes(clue1.text)) continue;
      expect(text).not.toContain(secret);
    }
    const none = narrate(withRoll(null));
    expect(`${none.system}\n${none.user}`).not.toContain("learned (settled)");
  });

  it("carries the snapshot sections in the narrate, audit and chronicle prompts", () => {
    const by = (n: string) => prompts.find((p) => p.name === n)?.text ?? "";
    expect(by("narrate the-keeper action")).toContain(
      "## Party (player characters)",
    );
    expect(by("audit with the snapshot sections")).toContain(
      "## Other characters (the world)",
    );
    expect(by("chronicle with the snapshot section")).toContain(
      "## State at the end of this transcript",
    );
    expect(by("companion odo active=true")).toContain("## State");
  });

  it("the react prompt builder takes the player view, never the full seed", () => {
    // @ts-expect-error the DM-only seed is not a PlayerSeedView
    buildReactPrompt({ ...reactInput(), seed: SEED });
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
          snapshot,
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

describe("narrate prompt: fact-sheet sections (spec 098 D4)", () => {
  const sheetOf = (f: NarrationFacts) =>
    buildFactSheet({
      settled: f,
      beat: f.actions.length
        ? [
            {
              actionId: "act-x",
              characterId: "tamsin",
              scope: "character",
              actor: USER_ID,
              text: "I ask Wenna about the bell.",
            },
          ]
        : [],
      projections,
      nameOf: (id) => id ?? "The scene",
      submissions: [],
    });
  const promptFor = (f: NarrationFacts) =>
    buildNarratePrompt({
      seed: VIEW,
      roster: rosterOf(projections.party),
      assembled,
      snapshot,
      facts: f,
      sheet: sheetOf(f),
      prior: null,
    });

  it("lists Slots, Restate and Speakers for an action", () => {
    const f = facts({
      trigger: "commit",
      beatId: "the-keeper",
      beatNpcIds: ["wenna"],
      action: true,
    });
    const { user } = promptFor(f);
    expect(user).toContain("## Slots\nrestate\ndescribe");
    expect(user).toContain("## Restate\n");
    expect(user).toContain("(no-effect)");
    expect(user).toContain("## Speakers\nWenna");
    expect(user).not.toContain("Settled question");
  });

  it("states the Settled question and withholds the question text on a clarify", () => {
    const { user } = promptFor(clarifyFacts);
    expect(user).toContain(
      "## Settled question\nCode asks this; do not ask it.",
    );
    expect(user).toContain("## Slots\nrestate\ndescribe\n\n");
    expect(user).not.toContain("Which way do you press on?");
    expect(user).toContain("Waiting on an answer for act-x");
  });
});
