import {
  fixtureIds as ids,
  mechanicsBatch,
  numberRows,
  type SessionFixture,
} from "./build.js";

const sessionId = "00000000-0000-4000-8000-000000000103";

export const turnModeCombat: SessionFixture = {
  name: "turn-mode-combat",
  description:
    "A goblin fight in turn mode. Initiative starts the encounter, the table switches from free to turn with Ana active, Ana attacks and hits the goblin, damage lands, the turn advances to Bram, and Bram's attack is refused by the engine because its dice expression has no d20. The encounter ends and the table returns to free mode.",
  sessionId,
  viewers: {
    dm: { role: "dm" },
    players: [
      { role: "player", userId: ids.playerUserId },
      { role: "player", userId: ids.otherPlayerUserId },
    ],
  },
  events: numberRows(sessionId, [
    ...mechanicsBatch({ batchId: "b-add-ana", actor: ids.dmActor }, [
      {
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
    ]),
    ...mechanicsBatch({ batchId: "b-add-bram", actor: ids.dmActor }, [
      {
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
    ]),
    ...mechanicsBatch({ batchId: "b-add-goblin", actor: ids.dmActor }, [
      {
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
          ac: 12,
          defenses: {
            resistances: [],
            vulnerabilities: [],
            immunities: [],
          },
        },
      },
    ]),
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
            userId: "00000000-0000-4000-8000-000000000001",
          },
          combatantId: "ana",
          class: "Fighter",
          level: 3,
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
            kind: "ai-companion",
            actor: "ai:companion:bram",
          },
          combatantId: "bram",
          class: "Ranger",
          level: 3,
        },
      },
    },
    ...mechanicsBatch({ batchId: "b-init", actor: ids.dmActor }, [
      {
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
            faces: [15],
            kept: [true],
            subtotal: 15,
          },
        ],
        total: 15,
        natural: 15,
      },
      {
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
            faces: [12],
            kept: [true],
            subtotal: 12,
          },
        ],
        total: 12,
        natural: 12,
      },
      {
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
      {
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
              total: 15,
              bonus: 0,
            },
            {
              combatantId: "bram",
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
    ]),
    {
      actor: ids.dmActor,
      type: "table-mode.changed",
      payload: {
        reason: "Combat begins",
        before: {
          mode: "free",
        },
        after: {
          mode: "turn",
          activeActor: "00000000-0000-4000-8000-000000000001",
          activeCharacterId: "ana",
        },
      },
    },
    {
      actor: ids.playerUserId,
      type: "action.declared",
      payload: {
        actionId: "act-ana-attack",
        characterId: "ana",
        scope: "character",
        text: "Ana attacks the goblin with her sword.",
      },
    },
    {
      actor: ids.playerUserId,
      type: "action.committed",
      payload: {
        actionId: "act-ana-attack",
        authority: "active-player",
      },
    },
    ...mechanicsBatch(
      {
        batchId: "b-ana-attack",
        actor: ids.dmActor,
        actionId: "act-ana-attack",
      },
      [
        {
          type: "dice.rolled",
          v: 1,
          reason: "Ana swings at the goblin",
          expression: "1d20+4",
          mode: "normal",
          purpose: "attack",
          critical: false,
          combatantId: "ana",
          terms: [
            {
              kind: "dice",
              sign: 1,
              count: 1,
              sides: 20,
              keep: null,
              faces: [14],
              kept: [true],
              subtotal: 14,
            },
            {
              kind: "modifier",
              value: 4,
            },
          ],
          total: 18,
          natural: 14,
        },
        {
          type: "attack.resolved",
          v: 1,
          reason: "Ana swings at the goblin",
          attackerId: "ana",
          targetId: "goblin",
          rollIndex: 0,
          ac: 12,
          acSource: "record",
          total: 18,
          natural: 14,
          outcome: "hit",
        },
      ],
    ),
    ...mechanicsBatch(
      {
        batchId: "b-ana-damage",
        actor: ids.dmActor,
        actionId: "act-ana-attack",
      },
      [
        {
          type: "hp.changed",
          v: 1,
          reason: "Ana's sword hits the goblin",
          combatantId: "goblin",
          cause: "damage",
          amount: 5,
          rawAmount: 5,
          components: [
            {
              damageType: "slashing",
              raw: 5,
              applied: 5,
              adjustment: "none",
              rollIndex: null,
            },
          ],
          defensesSource: "record",
          critical: false,
          rollIndex: null,
          before: {
            current: 7,
            temp: 0,
          },
          after: {
            current: 2,
            temp: 0,
          },
        },
      ],
    ),
    {
      actor: ids.dmActor,
      type: "action.resolved",
      payload: {
        actionId: "act-ana-attack",
        outcome: "applied",
        batchIds: ["b-ana-attack", "b-ana-damage"],
        refusalCode: null,
      },
    },
    ...mechanicsBatch({ batchId: "b-turn-1", actor: ids.dmActor }, [
      {
        type: "turn.advanced",
        v: 1,
        reason: "Ana's turn ends",
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
    ]),
    {
      actor: ids.dmActor,
      type: "table-mode.changed",
      payload: {
        reason: "The turn passes to Bram",
        before: {
          mode: "turn",
          activeActor: "00000000-0000-4000-8000-000000000001",
          activeCharacterId: "ana",
        },
        after: {
          mode: "turn",
          activeActor: "ai:companion:bram",
          activeCharacterId: "bram",
        },
      },
    },
    {
      actor: ids.companionActor,
      type: "action.declared",
      payload: {
        actionId: "act-bram-attack",
        characterId: "bram",
        scope: "character",
        text: "Bram throws a handaxe at the goblin.",
      },
    },
    {
      actor: ids.companionActor,
      type: "action.committed",
      payload: {
        actionId: "act-bram-attack",
        authority: "active-player",
      },
    },
    {
      actor: ids.dmActor,
      type: "action.resolved",
      payload: {
        actionId: "act-bram-attack",
        outcome: "refused",
        batchIds: [],
        refusalCode: "D20_TERM_REQUIRED",
      },
    },
    ...mechanicsBatch({ batchId: "b-end", actor: ids.dmActor }, [
      {
        type: "encounter.ended",
        v: 1,
        reason: "The goblin flees and the fight is over",
        before: {
          round: 1,
          turnIndex: 1,
          order: [
            {
              combatantId: "ana",
              total: 15,
              bonus: 0,
            },
            {
              combatantId: "bram",
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
        after: null,
      },
    ]),
    {
      actor: ids.dmActor,
      type: "table-mode.changed",
      payload: {
        reason: "Combat ends",
        before: {
          mode: "turn",
          activeActor: "ai:companion:bram",
          activeCharacterId: "bram",
        },
        after: {
          mode: "free",
        },
      },
    },
  ]),
};
