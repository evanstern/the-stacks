import { randomUUID } from "node:crypto";
import { scriptedRng } from "@the-stacks/dnd5e-engine";
import {
  mechanicsProposal,
  type Proposer,
  type StoredEvent,
} from "@the-stacks/session-model";
import { afterAll, describe, expect, it, vi } from "vitest";
import { createDb, probeReachable } from "../src/db.js";
import { readFrom, SeqConflictError } from "../src/events/log.js";
import { createGate, type GateResult } from "../src/gate/index.js";
import { appendSessionEvents, toStoredEvent } from "../src/session/events.js";
import { loadProjections } from "../src/session/projections.js";

/**
 * Integration tests for the server gate (spec 029, Phase 4) against a REAL Postgres.
 * Every test uses a fresh session id; the events table is append-only and shared.
 */

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const db = databaseUrl ? createDb(databaseUrl) : undefined;
const reachable = db ? await probeReachable(db.$client, 2000) : false;

if (!reachable) {
  const notice =
    `\n⚠️  SKIPPING apps/server/test/gate.integration.test.ts — no reachable database ` +
    `(tried TEST_DATABASE_URL then DATABASE_URL; got ${databaseUrl ?? "<unset>"}). ` +
    `A skip here proves NOTHING about the gate on a real log.\n`;
  console.warn(notice);
  if (process.env.REQUIRE_DATABASE === "1") throw new Error(notice);
}

afterAll(async () => {
  await db?.$client.end();
});

function requireDb() {
  if (!db)
    throw new Error("gate integration tests require a reachable database");
  return db;
}

const DM_ID = "00000000-0000-4000-8000-0000000000d1";
const PLAYER_ID = "00000000-0000-4000-8000-0000000000a1";
const OTHER_ID = "00000000-0000-4000-8000-0000000000a2";

const operatorDm: Proposer = { kind: "human", userId: DM_ID, role: "operator" };
const player: Proposer = { kind: "human", userId: PLAYER_ID, role: "player" };
const otherPlayer: Proposer = {
  kind: "human",
  userId: OTHER_ID,
  role: "player",
};
const aiDm: Proposer = { kind: "ai", actor: "ai:dm" };

const addAna = {
  type: "combatant.add",
  combatant: {
    id: "ana",
    name: "Ana",
    hp: { max: 12 },
    zeroHpRule: "death-saves",
    initiativeBonus: 0,
    conModifier: 0,
    ac: 15,
    defenses: { resistances: [], vulnerabilities: [], immunities: [] },
    hitDice: [{ die: 8, total: 2 }],
    spellSlots: { standard: {}, pact: null },
  },
  reason: "Ana joins the session",
};

const lockpick = {
  type: "check.roll",
  combatantId: "ana",
  kind: "ability-check",
  ability: "dex",
  skill: null,
  expression: "1d20+5",
  mode: "normal",
  dc: 15,
  autoFail: null,
  reason: "Ana picks the vault lock",
};

const anaMember = {
  reason: "Ana joins the party",
  kind: "party",
  characterId: "ana",
  after: {
    characterId: "ana",
    name: "Ana",
    controller: { kind: "player", userId: PLAYER_ID },
    combatantId: "ana",
  },
};

function setup(opts: { faces?: number[] } = {}) {
  const sessionId = randomUUID();
  let faces = opts.faces ?? [13];
  let n = 0;
  const gate = createGate({
    db: requireDb(),
    rng: () => scriptedRng(faces),
    newId: () => `id-${sessionId.slice(0, 8)}-${++n}`,
  });
  const rows = async () =>
    (await readFrom(requireDb(), { sessionId, limit: 500 })).map(toStoredEvent);
  const must = async (r: Promise<GateResult>) => {
    const result = await r;
    if (!result.ok)
      throw new Error(`unexpected refusal ${result.refusal.code}`);
    return result;
  };
  return {
    sessionId,
    gate,
    rows,
    must,
    setFaces: (next: number[]) => {
      faces = next;
    },
  };
}

type Ctx = ReturnType<typeof setup>;

async function seatDm(c: Ctx) {
  await c.must(
    c.gate.handle(c.sessionId, operatorDm, {
      kind: "dm.seat",
      reason: "A human takes the DM seat",
      after: { kind: "human", userId: DM_ID },
    }),
  );
}

async function seedParty(c: Ctx) {
  await c.must(
    c.gate.submit(c.sessionId, operatorDm, mechanicsProposal(addAna as never)),
  );
  await c.must(c.gate.submit(c.sessionId, operatorDm, anaMember));
}

const kinds = (events: StoredEvent[]) => events.map((e) => e.type);

function refusalOf(result: GateResult) {
  if (result.ok) throw new Error("expected a refusal");
  return result.refusal;
}

const declare = (
  actionId: string,
  scope: "character" | "party" = "character",
) => ({
  kind: "action.declare",
  action: {
    actionId,
    characterId: scope === "character" ? "ana" : null,
    scope,
    text: "Ana tries something",
  },
});

describe.skipIf(!reachable)("gate — auto (AI seat)", () => {
  it("applies a mechanics proposal at once as one atomic batch, with no proposal rows", async () => {
    const c = setup();
    const result = await c.must(
      c.gate.submit(c.sessionId, aiDm, mechanicsProposal(addAna as never)),
    );
    expect(result.outcome).toBe("applied");
    const rows = await c.rows();
    expect(kinds(rows)).toEqual(["combatant.added"]);
    expect(rows.some((r) => r.type.startsWith("proposal."))).toBe(false);

    await c.must(
      c.gate.submit(c.sessionId, aiDm, {
        ...anaMember,
      }),
    );
    c.setFaces([13]);
    const roll = await c.must(
      c.gate.submit(c.sessionId, aiDm, mechanicsProposal(lockpick as never)),
    );
    if (roll.outcome !== "applied") throw new Error("expected applied");
    expect(roll.batchId).not.toBeNull();
    const all = await c.rows();
    const batch = all.slice(2);
    expect(batch.map((r) => r.seq)).toEqual(batch.map((_, i) => 3 + i));
    expect(all.every((r) => !r.type.startsWith("proposal."))).toBe(true);
  });
});

describe.skipIf(!reachable)("gate — ask (human seat)", () => {
  it("records one DM-only proposal.created, applies effects then approval on approve", async () => {
    const c = setup();
    await seatDm(c);
    await seedParty(c);
    const before = (await c.rows()).length;

    const pending = await c.must(
      c.gate.submit(c.sessionId, aiDm, mechanicsProposal(lockpick as never)),
    );
    if (pending.outcome !== "pending") throw new Error("expected pending");
    expect(pending.events).toHaveLength(1);
    const created = pending.events[0];
    expect(created.type).toBe("proposal.created");
    expect(created.visibility).toBe("dm");
    expect(created.actor).toBe("ai:dm");
    expect((created.payload as { policy: string }).policy).toBe("ask");
    expect(await c.rows()).toHaveLength(before + 1);

    const approved = await c.must(
      c.gate.handle(c.sessionId, operatorDm, {
        kind: "proposal.approve",
        proposalId: pending.proposalId,
      }),
    );
    expect(approved.outcome).toBe("decided");
    const events = approved.events;
    expect(events.length).toBeGreaterThan(1);
    expect(events.map((e) => e.seq)).toEqual(
      events.map((_, i) => created.seq + 1 + i),
    );
    const last = events[events.length - 1];
    expect(last.type).toBe("proposal.approved");
    expect(last.actor).toBe(DM_ID);
    const effect = events[0].payload as { proposalId: string | null };
    expect(effect.proposalId).toBe(pending.proposalId);
    expect((last.payload as { batchId: string | null }).batchId).toBe(
      (events[0].payload as { batchId: string }).batchId,
    );

    const p = await loadProjections(requireDb(), c.sessionId, { role: "dm" });
    expect(p.proposals.map((v) => v.status)).toEqual(["approved"]);
  });

  it("appends proposal.rejected on reject and applies nothing", async () => {
    const c = setup();
    await seatDm(c);
    const pending = await c.must(
      c.gate.submit(c.sessionId, aiDm, {
        kind: "narration",
        narration: { text: "The door groans open.", actionIds: [] },
      }),
    );
    if (pending.outcome !== "pending") throw new Error("expected pending");
    const before = (await c.rows()).length;
    const rejected = await c.must(
      c.gate.handle(c.sessionId, operatorDm, {
        kind: "proposal.reject",
        proposalId: pending.proposalId,
        reason: "Not yet",
      }),
    );
    expect(kinds(rejected.events)).toEqual(["proposal.rejected"]);
    expect(await c.rows()).toHaveLength(before + 1);
  });
});

describe.skipIf(!reachable)("gate — suggest", () => {
  it("shows a suggestion, applies nothing, and refuses approval", async () => {
    const c = setup();
    await seatDm(c);
    const before = (await c.rows()).length;
    const result = await c.must(
      c.gate.submit(c.sessionId, aiDm, {
        kind: "scene",
        reason: "The party reaches the vault",
        after: {
          sceneId: "vault",
          title: "The vault door",
          summary: "A heavy iron door.",
          location: "Undercroft",
        },
      }),
    );
    if (result.outcome !== "suggested") throw new Error("expected suggested");
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe("proposal.created");
    expect((result.events[0].payload as { policy: string }).policy).toBe(
      "suggest",
    );
    const approve = await c.gate.handle(c.sessionId, operatorDm, {
      kind: "proposal.approve",
      proposalId: result.proposalId,
    });
    expect(refusalOf(approve).code).toBe("PROPOSAL_NOT_APPROVABLE");
    const rows = await c.rows();
    expect(rows).toHaveLength(before + 1);
    expect(rows.some((r) => r.type === "scene.changed")).toBe(false);
  });
});

describe.skipIf(!reachable)("gate — direct DM command", () => {
  it("applies a seated human DM's mechanics with no proposal rows; refuses a player's", async () => {
    const c = setup();
    await seatDm(c);
    await seedParty(c);
    const result = await c.must(
      c.gate.submit(
        c.sessionId,
        operatorDm,
        mechanicsProposal(lockpick as never),
      ),
    );
    expect(result.outcome).toBe("applied");
    expect((await c.rows()).some((r) => r.type.startsWith("proposal."))).toBe(
      false,
    );
    const before = (await c.rows()).length;
    const refused = await c.gate.submit(
      c.sessionId,
      player,
      mechanicsProposal(lockpick as never),
    );
    expect(refusalOf(refused).code).toBe("NOT_AUTHORIZED");
    expect(await c.rows()).toHaveLength(before);
  });

  it("produces the same engine events as an approved proposal (AC #7)", async () => {
    const direct = setup();
    await seatDm(direct);
    await seedParty(direct);
    const d = await direct.must(
      direct.gate.submit(
        direct.sessionId,
        operatorDm,
        mechanicsProposal(lockpick as never),
      ),
    );

    const asked = setup();
    await seatDm(asked);
    await seedParty(asked);
    const pending = await asked.must(
      asked.gate.submit(
        asked.sessionId,
        aiDm,
        mechanicsProposal(lockpick as never),
      ),
    );
    if (pending.outcome !== "pending") throw new Error("expected pending");
    const a = await asked.must(
      asked.gate.handle(asked.sessionId, operatorDm, {
        kind: "proposal.approve",
        proposalId: pending.proposalId,
      }),
    );
    const engineEvents = (events: StoredEvent[]) =>
      events
        .filter((e) => !e.type.startsWith("proposal."))
        .map((e) => (e.payload as { event: unknown }).event);
    expect(engineEvents(a.events)).toEqual(engineEvents(d.events));
  });
});

describe.skipIf(!reachable)("gate — operator seated as a character", () => {
  it("accepts declare and commit by seat (control), not account role (TASK-0048)", async () => {
    const c = setup();
    await seatDm(c); // a different user holds the human DM seat
    await c.must(
      c.gate.submit(
        c.sessionId,
        operatorDm,
        mechanicsProposal(addAna as never),
      ),
    );
    // An operator who is NOT the DM controls Ana.
    const seatedOperator: Proposer = {
      kind: "human",
      userId: PLAYER_ID,
      role: "operator",
    };
    await c.must(c.gate.submit(c.sessionId, operatorDm, anaMember));
    await c.must(
      c.gate.submit(c.sessionId, seatedOperator, declare("pick-lock")),
    );
    const ok = await c.must(
      c.gate.submit(c.sessionId, seatedOperator, {
        kind: "action.commit",
        actionId: "pick-lock",
      }),
    );
    expect(ok.events[0].type).toBe("action.committed");
    expect((ok.events[0].payload as { authority: string }).authority).toBe(
      "declarer",
    );
    // The operator role alone confers no control: an operator who controls nothing is refused.
    const stranger: Proposer = {
      kind: "human",
      userId: OTHER_ID,
      role: "operator",
    };
    const refused = await c.gate.submit(c.sessionId, stranger, declare("x"));
    expect(refusalOf(refused).code).toBeDefined();
  });
});

describe.skipIf(!reachable)("gate — commit authority", () => {
  it("free mode: the declarer commits (declarer); a non-controller is refused", async () => {
    const c = setup();
    await seatDm(c);
    await seedParty(c);
    await c.must(c.gate.submit(c.sessionId, player, declare("pick-lock")));
    const refused = await c.gate.submit(c.sessionId, otherPlayer, {
      kind: "action.commit",
      actionId: "pick-lock",
    });
    expect(refusalOf(refused).code).toBe("COMMIT_NOT_ALLOWED");
    const ok = await c.must(
      c.gate.submit(c.sessionId, player, {
        kind: "action.commit",
        actionId: "pick-lock",
      }),
    );
    expect(ok.events[0].type).toBe("action.committed");
    expect((ok.events[0].payload as { authority: string }).authority).toBe(
      "declarer",
    );
  });

  it("turn mode: the active player commits (active-player)", async () => {
    const c = setup();
    await seatDm(c);
    await seedParty(c);
    await c.must(
      c.gate.submit(c.sessionId, operatorDm, {
        kind: "table-mode",
        reason: "Combat",
        after: {
          mode: "turn",
          activeActor: PLAYER_ID,
          activeCharacterId: "ana",
        },
      }),
    );
    await c.must(c.gate.submit(c.sessionId, player, declare("swing")));
    const ok = await c.must(
      c.gate.submit(c.sessionId, player, {
        kind: "action.commit",
        actionId: "swing",
      }),
    );
    expect((ok.events[0].payload as { authority: string }).authority).toBe(
      "active-player",
    );
  });

  it("party scope: the one human player commits (group)", async () => {
    const c = setup();
    await seatDm(c);
    await seedParty(c);
    await c.must(c.gate.submit(c.sessionId, player, declare("rest", "party")));
    const ok = await c.must(
      c.gate.submit(c.sessionId, player, {
        kind: "action.commit",
        actionId: "rest",
      }),
    );
    expect((ok.events[0].payload as { authority: string }).authority).toBe(
      "group",
    );
  });

  it("the DM commits any open action (dm)", async () => {
    const c = setup();
    await seatDm(c);
    await seedParty(c);
    await c.must(c.gate.submit(c.sessionId, player, declare("sneak")));
    const ok = await c.must(
      c.gate.submit(c.sessionId, operatorDm, {
        kind: "action.commit",
        actionId: "sneak",
      }),
    );
    expect((ok.events[0].payload as { authority: string }).authority).toBe(
      "dm",
    );
  });
});

describe.skipIf(!reachable)("gate — refusals", () => {
  it("returns the engine's code for a direct command and writes nothing", async () => {
    const c = setup();
    await seatDm(c);
    await seedParty(c);
    const before = (await c.rows()).length;
    const refused = refusalOf(
      await c.gate.submit(
        c.sessionId,
        operatorDm,
        mechanicsProposal({ ...lockpick, combatantId: "ghost" } as never),
      ),
    );
    expect(refused.source).toBe("engine");
    expect(refused.code).toBe("UNKNOWN_COMBATANT");
    expect(await c.rows()).toHaveLength(before);
  });

  it("refuses an ask proposal before recording it", async () => {
    const c = setup();
    await seatDm(c);
    await seedParty(c);
    const before = (await c.rows()).length;
    const refused = refusalOf(
      await c.gate.submit(
        c.sessionId,
        aiDm,
        mechanicsProposal({ ...lockpick, combatantId: "ghost" } as never),
      ),
    );
    expect(refused.source).toBe("engine");
    expect(refused.code).toBe("UNKNOWN_COMBATANT");
    expect(await c.rows()).toHaveLength(before);
  });

  it("refuses an approval that became illegal and leaves the proposal pending", async () => {
    const c = setup();
    await seatDm(c);
    await seedParty(c);
    await c.must(c.gate.submit(c.sessionId, player, declare("pick-lock")));
    const pending = await c.must(
      c.gate.submit(c.sessionId, aiDm, {
        kind: "action.comment",
        comment: {
          actionId: "pick-lock",
          stance: "comment",
          text: "The lock looks old.",
        },
      }),
    );
    if (pending.outcome !== "pending") throw new Error("expected pending");
    await c.must(
      c.gate.submit(c.sessionId, player, {
        kind: "action.commit",
        actionId: "pick-lock",
      }),
    );
    const before = (await c.rows()).length;
    const refused = refusalOf(
      await c.gate.handle(c.sessionId, operatorDm, {
        kind: "proposal.approve",
        proposalId: pending.proposalId,
      }),
    );
    expect(refused.code).toBe("ACTION_NOT_OPEN");
    expect(await c.rows()).toHaveLength(before);
    const p = await loadProjections(requireDb(), c.sessionId, { role: "dm" });
    expect(p.proposals[0].status).toBe("pending");
  });

  it("refuses NOT_DM, UNKNOWN_PROPOSAL and PROPOSAL_NOT_PENDING", async () => {
    const c = setup();
    await seatDm(c);
    const pending = await c.must(
      c.gate.submit(c.sessionId, aiDm, {
        kind: "narration",
        narration: { text: "Dust falls.", actionIds: [] },
      }),
    );
    if (pending.outcome !== "pending") throw new Error("expected pending");
    expect(
      refusalOf(
        await c.gate.handle(c.sessionId, player, {
          kind: "proposal.approve",
          proposalId: pending.proposalId,
        }),
      ).code,
    ).toBe("NOT_DM");
    expect(
      refusalOf(
        await c.gate.handle(c.sessionId, operatorDm, {
          kind: "proposal.approve",
          proposalId: "nope",
        }),
      ).code,
    ).toBe("UNKNOWN_PROPOSAL");
    await c.must(
      c.gate.handle(c.sessionId, operatorDm, {
        kind: "proposal.approve",
        proposalId: pending.proposalId,
      }),
    );
    expect(
      refusalOf(
        await c.gate.handle(c.sessionId, operatorDm, {
          kind: "proposal.reject",
          proposalId: pending.proposalId,
          reason: null,
        }),
      ).code,
    ).toBe("PROPOSAL_NOT_PENDING");
  });
});

describe.skipIf(!reachable)("gate — entry parsing", () => {
  it("refuses INVALID_PROPOSAL with zero seam calls", async () => {
    const seam = vi.fn(appendSessionEvents);
    const sessionId = randomUUID();
    const gate = createGate({ db: requireDb(), appendSessionEvents: seam });
    for (const input of ["a raw string", {}, { kind: "nope" }, null]) {
      expect(refusalOf(await gate.submit(sessionId, aiDm, input)).code).toBe(
        "INVALID_PROPOSAL",
      );
      expect(refusalOf(await gate.handle(sessionId, aiDm, input)).code).toBe(
        "INVALID_PROPOSAL",
      );
    }
    expect(seam).not.toHaveBeenCalled();
  });
});

describe.skipIf(!reachable)("gate — seat and policy", () => {
  it("lets only an operator seat the DM", async () => {
    const c = setup();
    const refused = await c.gate.handle(c.sessionId, player, {
      kind: "dm.seat",
      reason: "I want it",
      after: { kind: "human", userId: PLAYER_ID },
    });
    expect(refusalOf(refused).code).toBe("NOT_AUTHORIZED");
    await seatDm(c);
    const rows = await c.rows();
    expect(rows[0].type).toBe("dm.seat.changed");
    expect((rows[0].payload as { before: { kind: string } }).before.kind).toBe(
      "ai",
    );
  });

  it("changes the effective policy through gate.policy", async () => {
    const c = setup();
    await seatDm(c);
    const asked = await c.must(
      c.gate.submit(c.sessionId, aiDm, {
        kind: "narration",
        narration: { text: "Wind howls.", actionIds: [] },
      }),
    );
    expect(asked.outcome).toBe("pending");
    const set = await c.must(
      c.gate.handle(c.sessionId, operatorDm, {
        kind: "gate.policy",
        reason: "Trust the narrator",
        proposalKind: "narration",
        policy: "auto",
      }),
    );
    expect(
      (set.events[0].payload as { before: string; after: string }).before,
    ).toBe("ask");
    const applied = await c.must(
      c.gate.submit(c.sessionId, aiDm, {
        kind: "narration",
        narration: { text: "Wind howls again.", actionIds: [] },
      }),
    );
    expect(applied.outcome).toBe("applied");
    expect(applied.events[0].type).toBe("narration");
  });
});

describe.skipIf(!reachable)("gate — sequence conflicts", () => {
  function conflicting(times: number) {
    let thrown = 0;
    const seam: typeof appendSessionEvents = async (d, inputs, options) => {
      if (thrown < times) {
        thrown++;
        throw new SeqConflictError(options?.expectedLastSeq ?? 0, -1);
      }
      return appendSessionEvents(d, inputs, options);
    };
    return seam;
  }

  it("retries twice and then succeeds", async () => {
    const sessionId = randomUUID();
    const gate = createGate({
      db: requireDb(),
      appendSessionEvents: conflicting(2),
    });
    const result = await gate.submit(sessionId, aiDm, {
      kind: "journal",
      entry: {
        entryId: "e1",
        title: "Vault",
        body: "The vault was found.",
        sourceActionIds: [],
      },
    });
    expect(result.ok).toBe(true);
  });

  it("refuses CONFLICT after three conflicts and lands zero rows", async () => {
    const sessionId = randomUUID();
    const gate = createGate({
      db: requireDb(),
      appendSessionEvents: conflicting(3),
    });
    const result = await gate.submit(sessionId, aiDm, {
      kind: "journal",
      entry: {
        entryId: "e1",
        title: "Vault",
        body: "The vault was found.",
        sourceActionIds: [],
      },
    });
    expect(refusalOf(result).code).toBe("CONFLICT");
    const stored = await readFrom(requireDb(), { sessionId, limit: 10 });
    expect(stored).toHaveLength(0);
  });
});

describe.skipIf(!reachable)("gate — race", () => {
  it("applies exactly one of two concurrent approvals", async () => {
    const c = setup();
    await seatDm(c);
    await seedParty(c);
    const pending = await c.must(
      c.gate.submit(c.sessionId, aiDm, mechanicsProposal(lockpick as never)),
    );
    if (pending.outcome !== "pending") throw new Error("expected pending");
    const approve = () =>
      c.gate.handle(c.sessionId, operatorDm, {
        kind: "proposal.approve",
        proposalId: pending.proposalId,
      });
    const results = await Promise.all([approve(), approve()]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const lost = results.find((r) => !r.ok);
    expect(lost && refusalOf(lost).code).toBe("PROPOSAL_NOT_PENDING");
    const rows = await c.rows();
    expect(rows.filter((r) => r.type === "proposal.approved")).toHaveLength(1);
    expect(rows.filter((r) => r.type === "check.resolved")).toHaveLength(1);
  });
});

describe.skipIf(!reachable)("gate — onAppended", () => {
  it("delivers the stored rows in order, and a throwing listener changes nothing", async () => {
    const c = setup();
    const heard: StoredEvent[][] = [];
    c.gate.onAppended(() => {
      throw new Error("listener boom");
    });
    c.gate.onAppended((_id, events) => heard.push(events));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await c.must(
      c.gate.submit(c.sessionId, aiDm, mechanicsProposal(addAna as never)),
    );
    spy.mockRestore();
    expect(heard).toHaveLength(1);
    expect(heard[0]).toEqual(result.events);
    expect(heard[0].map((e) => e.seq)).toEqual(heard[0].map((_, i) => 1 + i));
  });
});

describe.skipIf(!reachable)(
  "gate — downed character (CHARACTER_UNABLE)",
  () => {
    it("refuses a declaration for an unconscious character and leaves the log unchanged", async () => {
      const c = setup();
      await seatDm(c);
      await seedParty(c);
      await c.must(
        c.gate.submit(
          c.sessionId,
          operatorDm,
          mechanicsProposal({
            type: "damage.apply",
            targetId: "ana",
            components: [
              { amount: { kind: "fixed", value: 14 }, damageType: "fire" },
            ],
            reason: "Ana drops",
          } as never),
        ),
      );
      const before = (await c.rows()).length;
      const refused = await c.gate.submit(
        c.sessionId,
        player,
        declare("pick-lock"),
      );
      const refusal = refusalOf(refused);
      expect(refusal.source).toBe("gate");
      expect(refusal.code).toBe("CHARACTER_UNABLE");
      expect(refusal.details).toEqual({
        characterId: "ana",
        reason: "life-state",
        lifeState: "unconscious",
      });
      expect((await c.rows()).length).toBe(before);
    });
  },
);
