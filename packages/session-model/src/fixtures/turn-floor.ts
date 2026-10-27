import { fixtureIds as ids, numberRows, type SessionFixture } from "./build.js";

const sessionId = "00000000-0000-4000-8000-000000000110";

export const turnFloor: SessionFixture = {
  name: "turn-floor",
  description:
    "Floor passing in turn mode (specs/049-turn-floor). Ana and Bram (two players) and Pip (an AI companion) fight a goblin under the AI DM. Ana ends her turn with a floor request; Bram commits his arrow on his own turn and resolve advances; Pip ends hers; the goblin's turn closes round 1. In round 2 a human DM takes and returns the floor, then the AI DM seats again and passes Ana's turn as absent, with a floor presence marker naming only Bram. Last, Bram declares a party action and the AI DM commits it with a stall override: a signoff marker, then a dm commit.",
  sessionId,
  viewers: {
    dm: { role: "dm" },
    players: [
      { role: "player", userId: ids.playerUserId },
      { role: "player", userId: ids.otherPlayerUserId },
    ],
  },
  events: numberRows(sessionId, [
    {
      actor: ids.dmActor,
      type: "party.member.changed",
      payload: {
        reason: "Ana joins the party",
        characterId: "ana",
        before: null,
        after: {
          characterId: "ana",
          name: "Ana",
          controller: {
            kind: "player",
            userId: ids.playerUserId,
          },
          combatantId: "ana",
        },
      },
    },
    {
      actor: ids.dmActor,
      type: "party.member.changed",
      payload: {
        reason: "Bram joins the party",
        characterId: "bram",
        before: null,
        after: {
          characterId: "bram",
          name: "Bram",
          controller: {
            kind: "player",
            userId: ids.otherPlayerUserId,
          },
          combatantId: "bram",
        },
      },
    },
    {
      actor: ids.dmActor,
      type: "party.member.changed",
      payload: {
        reason: "Pip joins the party",
        characterId: "pip",
        before: null,
        after: {
          characterId: "pip",
          name: "Pip",
          controller: {
            kind: "ai-companion",
            actor: "ai:companion:pip",
          },
          combatantId: "pip",
        },
      },
    },
    {
      actor: ids.dmActor,
      type: "combatant.added",
      payload: {
        batchId: "b-add-ana",
        index: 0,
        count: 1,
        actionId: null,
        proposalId: null,
        event: {
          type: "combatant.added",
          v: 1,
          reason: "Ana joins the session",
          combatantId: "ana",
          before: null,
          after: {
            id: "ana",
            name: "Ana",
            hp: {
              current: 12,
              max: 12,
              temp: 0,
            },
            zeroHpRule: "death-saves",
            lifeState: "conscious",
            deathSaves: {
              successes: 0,
              failures: 0,
            },
            conditions: [],
            conditionSeq: 0,
            hitDice: [
              {
                die: 8,
                total: 2,
                remaining: 2,
              },
            ],
            spellSlots: {
              standard: {},
              pact: null,
            },
            initiativeBonus: 0,
            conModifier: 0,
            ac: 15,
            defenses: {
              resistances: [],
              vulnerabilities: [],
              immunities: [],
            },
          },
        },
      },
    },
    {
      actor: ids.dmActor,
      type: "combatant.added",
      payload: {
        batchId: "b-add-bram",
        index: 0,
        count: 1,
        actionId: null,
        proposalId: null,
        event: {
          type: "combatant.added",
          v: 1,
          reason: "Bram joins the session",
          combatantId: "bram",
          before: null,
          after: {
            id: "bram",
            name: "Bram",
            hp: {
              current: 10,
              max: 10,
              temp: 0,
            },
            zeroHpRule: "death-saves",
            lifeState: "conscious",
            deathSaves: {
              successes: 0,
              failures: 0,
            },
            conditions: [],
            conditionSeq: 0,
            hitDice: [
              {
                die: 8,
                total: 2,
                remaining: 2,
              },
            ],
            spellSlots: {
              standard: {},
              pact: null,
            },
            initiativeBonus: 0,
            conModifier: 0,
            ac: 14,
            defenses: {
              resistances: [],
              vulnerabilities: [],
              immunities: [],
            },
          },
        },
      },
    },
    {
      actor: ids.dmActor,
      type: "combatant.added",
      payload: {
        batchId: "b-add-pip",
        index: 0,
        count: 1,
        actionId: null,
        proposalId: null,
        event: {
          type: "combatant.added",
          v: 1,
          reason: "Pip joins the session",
          combatantId: "pip",
          before: null,
          after: {
            id: "pip",
            name: "Pip",
            hp: {
              current: 9,
              max: 9,
              temp: 0,
            },
            zeroHpRule: "death-saves",
            lifeState: "conscious",
            deathSaves: {
              successes: 0,
              failures: 0,
            },
            conditions: [],
            conditionSeq: 0,
            hitDice: [
              {
                die: 8,
                total: 2,
                remaining: 2,
              },
            ],
            spellSlots: {
              standard: {},
              pact: null,
            },
            initiativeBonus: 0,
            conModifier: 0,
            ac: 13,
            defenses: {
              resistances: [],
              vulnerabilities: [],
              immunities: [],
            },
          },
        },
      },
    },
    {
      actor: ids.dmActor,
      type: "combatant.added",
      payload: {
        batchId: "b-add-goblin",
        index: 0,
        count: 1,
        actionId: null,
        proposalId: null,
        event: {
          type: "combatant.added",
          v: 1,
          reason: "A goblin ambushes the party",
          combatantId: "goblin",
          before: null,
          after: {
            id: "goblin",
            name: "Goblin",
            hp: {
              current: 7,
              max: 7,
              temp: 0,
            },
            zeroHpRule: "dies",
            lifeState: "conscious",
            deathSaves: {
              successes: 0,
              failures: 0,
            },
            conditions: [],
            conditionSeq: 0,
            hitDice: [],
            spellSlots: {
              standard: {},
              pact: null,
            },
            initiativeBonus: 0,
            conModifier: 0,
            ac: 13,
            defenses: {
              resistances: [],
              vulnerabilities: [],
              immunities: [],
            },
          },
        },
      },
    },
    {
      actor: ids.dmActor,
      type: "dice.rolled",
      payload: {
        batchId: "b-init",
        index: 0,
        count: 5,
        actionId: null,
        proposalId: null,
        event: {
          type: "dice.rolled",
          v: 1,
          reason: "A goblin ambushes the party",
          expression: "1d20",
          mode: "normal",
          purpose: "initiative",
          critical: false,
          combatantId: "ana",
          terms: [
            {
              kind: "dice",
              sign: 1,
              count: 1,
              sides: 20,
              keep: null,
              faces: [18],
              kept: [true],
              subtotal: 18,
            },
          ],
          total: 18,
          natural: 18,
        },
      },
    },
    {
      actor: ids.dmActor,
      type: "dice.rolled",
      payload: {
        batchId: "b-init",
        index: 1,
        count: 5,
        actionId: null,
        proposalId: null,
        event: {
          type: "dice.rolled",
          v: 1,
          reason: "A goblin ambushes the party",
          expression: "1d20",
          mode: "normal",
          purpose: "initiative",
          critical: false,
          combatantId: "bram",
          terms: [
            {
              kind: "dice",
              sign: 1,
              count: 1,
              sides: 20,
              keep: null,
              faces: [15],
              kept: [true],
              subtotal: 15,
            },
          ],
          total: 15,
          natural: 15,
        },
      },
    },
    {
      actor: ids.dmActor,
      type: "dice.rolled",
      payload: {
        batchId: "b-init",
        index: 2,
        count: 5,
        actionId: null,
        proposalId: null,
        event: {
          type: "dice.rolled",
          v: 1,
          reason: "A goblin ambushes the party",
          expression: "1d20",
          mode: "normal",
          purpose: "initiative",
          critical: false,
          combatantId: "pip",
          terms: [
            {
              kind: "dice",
              sign: 1,
              count: 1,
              sides: 20,
              keep: null,
              faces: [12],
              kept: [true],
              subtotal: 12,
            },
          ],
          total: 12,
          natural: 12,
        },
      },
    },
    {
      actor: ids.dmActor,
      type: "dice.rolled",
      payload: {
        batchId: "b-init",
        index: 3,
        count: 5,
        actionId: null,
        proposalId: null,
        event: {
          type: "dice.rolled",
          v: 1,
          reason: "A goblin ambushes the party",
          expression: "1d20",
          mode: "normal",
          purpose: "initiative",
          critical: false,
          combatantId: "goblin",
          terms: [
            {
              kind: "dice",
              sign: 1,
              count: 1,
              sides: 20,
              keep: null,
              faces: [8],
              kept: [true],
              subtotal: 8,
            },
          ],
          total: 8,
          natural: 8,
        },
      },
    },
    {
      actor: ids.dmActor,
      type: "encounter.started",
      payload: {
        batchId: "b-init",
        index: 4,
        count: 5,
        actionId: null,
        proposalId: null,
        event: {
          type: "encounter.started",
          v: 1,
          reason: "A goblin ambushes the party",
          before: null,
          after: {
            round: 1,
            turnIndex: 0,
            order: [
              {
                combatantId: "ana",
                total: 18,
                bonus: 0,
              },
              {
                combatantId: "bram",
                total: 15,
                bonus: 0,
              },
              {
                combatantId: "pip",
                total: 12,
                bonus: 0,
              },
              {
                combatantId: "goblin",
                total: 8,
                bonus: 0,
              },
            ],
          },
        },
      },
    },
    {
      actor: ids.dmActor,
      type: "table-mode.changed",
      payload: {
        reason: "Combat starts in turn mode",
        before: {
          mode: "free",
        },
        after: {
          mode: "turn",
          activeActor: ids.playerUserId,
          activeCharacterId: "ana",
        },
      },
    },
    {
      actor: ids.playerUserId,
      type: "turn.advanced",
      payload: {
        batchId: "b-ana-end",
        index: 0,
        count: 1,
        actionId: null,
        proposalId: null,
        event: {
          type: "turn.advanced",
          v: 1,
          reason: "Ana ends her turn.",
          skipped: [],
          before: {
            round: 1,
            turnIndex: 0,
            combatantId: "ana",
          },
          after: {
            round: 1,
            turnIndex: 1,
            combatantId: "bram",
          },
        },
      },
    },
    {
      actor: ids.playerUserId,
      type: "table-mode.changed",
      payload: {
        reason: "Ana ends her turn.",
        before: {
          mode: "turn",
          activeActor: ids.playerUserId,
          activeCharacterId: "ana",
        },
        after: {
          mode: "turn",
          activeActor: ids.otherPlayerUserId,
          activeCharacterId: "bram",
        },
      },
    },
    {
      actor: ids.otherPlayerUserId,
      type: "action.declared",
      payload: {
        actionId: "act-bram",
        characterId: "bram",
        scope: "character",
        text: "Bram looses an arrow at the goblin.",
      },
    },
    {
      actor: ids.otherPlayerUserId,
      type: "action.committed",
      payload: {
        actionId: "act-bram",
        authority: "active-player",
      },
    },
    {
      actor: ids.dmActor,
      type: "turn.advanced",
      payload: {
        batchId: "b-bram-advance",
        index: 0,
        count: 1,
        actionId: "act-bram",
        proposalId: null,
        event: {
          type: "turn.advanced",
          v: 1,
          reason: "Bram's action resolves; the turn passes.",
          skipped: [],
          before: {
            round: 1,
            turnIndex: 1,
            combatantId: "bram",
          },
          after: {
            round: 1,
            turnIndex: 2,
            combatantId: "pip",
          },
        },
      },
    },
    {
      actor: ids.dmActor,
      type: "table-mode.changed",
      payload: {
        reason: "Bram's action resolves; the turn passes.",
        before: {
          mode: "turn",
          activeActor: ids.otherPlayerUserId,
          activeCharacterId: "bram",
        },
        after: {
          mode: "turn",
          activeActor: "ai:companion:pip",
          activeCharacterId: "pip",
        },
      },
    },
    {
      actor: "ai:companion:pip",
      type: "turn.advanced",
      payload: {
        batchId: "b-pip-end",
        index: 0,
        count: 1,
        actionId: null,
        proposalId: null,
        event: {
          type: "turn.advanced",
          v: 1,
          reason: "Pip ends her turn.",
          skipped: [],
          before: {
            round: 1,
            turnIndex: 2,
            combatantId: "pip",
          },
          after: {
            round: 1,
            turnIndex: 3,
            combatantId: "goblin",
          },
        },
      },
    },
    {
      actor: "ai:companion:pip",
      type: "table-mode.changed",
      payload: {
        reason: "Pip ends her turn.",
        before: {
          mode: "turn",
          activeActor: "ai:companion:pip",
          activeCharacterId: "pip",
        },
        after: {
          mode: "turn",
          activeActor: ids.dmActor,
          activeCharacterId: null,
        },
      },
    },
    {
      actor: ids.dmActor,
      type: "turn.advanced",
      payload: {
        batchId: "b-goblin-advance",
        index: 0,
        count: 1,
        actionId: null,
        proposalId: null,
        event: {
          type: "turn.advanced",
          v: 1,
          reason: "The goblin's turn ends.",
          skipped: [],
          before: {
            round: 1,
            turnIndex: 3,
            combatantId: "goblin",
          },
          after: {
            round: 2,
            turnIndex: 0,
            combatantId: "ana",
          },
        },
      },
    },
    {
      actor: ids.dmActor,
      type: "table-mode.changed",
      payload: {
        reason: "The goblin's turn ends.",
        before: {
          mode: "turn",
          activeActor: ids.dmActor,
          activeCharacterId: null,
        },
        after: {
          mode: "turn",
          activeActor: ids.playerUserId,
          activeCharacterId: "ana",
        },
      },
    },
    {
      actor: ids.dmUserId,
      type: "dm.seat.changed",
      payload: {
        reason: "The operator takes the DM seat",
        before: {
          kind: "ai",
        },
        after: {
          kind: "human",
          userId: ids.dmUserId,
        },
      },
    },
    {
      actor: ids.dmUserId,
      type: "table-mode.changed",
      payload: {
        reason: "The DM takes the floor.",
        before: {
          mode: "turn",
          activeActor: ids.playerUserId,
          activeCharacterId: "ana",
        },
        after: {
          mode: "turn",
          activeActor: ids.dmUserId,
          activeCharacterId: null,
        },
      },
    },
    {
      actor: ids.dmUserId,
      type: "table-mode.changed",
      payload: {
        reason: "The DM returns the floor.",
        before: {
          mode: "turn",
          activeActor: ids.dmUserId,
          activeCharacterId: null,
        },
        after: {
          mode: "turn",
          activeActor: ids.playerUserId,
          activeCharacterId: "ana",
        },
      },
    },
    {
      actor: ids.dmUserId,
      type: "dm.seat.changed",
      payload: {
        reason: "The operator hands the seat back to the AI",
        before: {
          kind: "human",
          userId: ids.dmUserId,
        },
        after: {
          kind: "ai",
        },
      },
    },
    {
      actor: "system",
      type: "presence.recorded",
      payload: {
        present: [ids.otherPlayerUserId],
        purpose: "floor",
      },
    },
    {
      actor: ids.dmActor,
      type: "turn.advanced",
      payload: {
        batchId: "b-absence-pass",
        index: 0,
        count: 1,
        actionId: null,
        proposalId: null,
        event: {
          type: "turn.advanced",
          v: 1,
          reason: "Ana is away; the DM passes her turn.",
          skipped: [],
          before: {
            round: 2,
            turnIndex: 0,
            combatantId: "ana",
          },
          after: {
            round: 2,
            turnIndex: 1,
            combatantId: "bram",
          },
        },
      },
    },
    {
      actor: ids.dmActor,
      type: "table-mode.changed",
      payload: {
        reason: "Ana is away; the DM passes her turn.",
        before: {
          mode: "turn",
          activeActor: ids.playerUserId,
          activeCharacterId: "ana",
        },
        after: {
          mode: "turn",
          activeActor: ids.otherPlayerUserId,
          activeCharacterId: "bram",
        },
      },
    },
    {
      actor: ids.otherPlayerUserId,
      type: "action.declared",
      payload: {
        actionId: "act-party",
        characterId: null,
        scope: "party",
        text: "We cross the rope bridge together.",
      },
    },
    {
      actor: "system",
      type: "presence.recorded",
      payload: {
        present: [ids.playerUserId, ids.otherPlayerUserId],
        purpose: "signoff",
        actionId: "act-party",
      },
    },
    {
      actor: ids.dmActor,
      type: "action.committed",
      payload: {
        actionId: "act-party",
        authority: "dm",
      },
    },
  ]),
};
