import type { MechanicsRecipe } from "./build.js";

/**
 * The engine command and scripted dice behind each mechanics batch of the fixtures. The
 * batches' events are committed as literal data; `fixtures.test.ts` re-runs every recipe
 * through the engine's `execute` and compares.
 */
export const recipes: readonly MechanicsRecipe[] = [
  {
    fixture: "free-mode-action",
    batchId: "b-add-ana",
    command: {
      type: "combatant.add",
      combatant: {
        id: "ana",
        name: "Ana",
        hp: {
          max: 12,
        },
        zeroHpRule: "death-saves",
        initiativeBonus: 0,
        conModifier: 0,
        ac: 15,
        defenses: {
          resistances: [],
          vulnerabilities: [],
          immunities: [],
        },
        hitDice: [
          {
            die: 8,
            total: 2,
          },
        ],
        spellSlots: {
          standard: {},
          pact: null,
        },
      },
      reason: "Ana joins the session",
    },
    faces: [],
  },
  {
    fixture: "free-mode-action",
    batchId: "b-add-bram",
    command: {
      type: "combatant.add",
      combatant: {
        id: "bram",
        name: "Bram",
        hp: {
          max: 10,
        },
        zeroHpRule: "death-saves",
        initiativeBonus: 0,
        conModifier: 0,
        ac: 14,
        defenses: {
          resistances: [],
          vulnerabilities: [],
          immunities: [],
        },
        hitDice: [
          {
            die: 8,
            total: 2,
          },
        ],
        spellSlots: {
          standard: {},
          pact: null,
        },
      },
      reason: "Bram joins the session",
    },
    faces: [],
  },
  {
    fixture: "free-mode-action",
    batchId: "b-lockpick",
    command: {
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
    },
    faces: [13],
  },
  {
    fixture: "turn-mode-combat",
    batchId: "b-add-ana",
    command: {
      type: "combatant.add",
      combatant: {
        id: "ana",
        name: "Ana",
        hp: {
          max: 12,
        },
        zeroHpRule: "death-saves",
        initiativeBonus: 0,
        conModifier: 0,
        ac: 15,
        defenses: {
          resistances: [],
          vulnerabilities: [],
          immunities: [],
        },
        hitDice: [
          {
            die: 8,
            total: 2,
          },
        ],
        spellSlots: {
          standard: {},
          pact: null,
        },
      },
      reason: "Ana joins the session",
    },
    faces: [],
  },
  {
    fixture: "turn-mode-combat",
    batchId: "b-add-bram",
    command: {
      type: "combatant.add",
      combatant: {
        id: "bram",
        name: "Bram",
        hp: {
          max: 10,
        },
        zeroHpRule: "death-saves",
        initiativeBonus: 0,
        conModifier: 0,
        ac: 14,
        defenses: {
          resistances: [],
          vulnerabilities: [],
          immunities: [],
        },
        hitDice: [
          {
            die: 8,
            total: 2,
          },
        ],
        spellSlots: {
          standard: {},
          pact: null,
        },
      },
      reason: "Bram joins the session",
    },
    faces: [],
  },
  {
    fixture: "turn-mode-combat",
    batchId: "b-add-goblin",
    command: {
      type: "combatant.add",
      combatant: {
        id: "goblin",
        name: "Goblin",
        hp: {
          max: 7,
        },
        zeroHpRule: "dies",
        initiativeBonus: 0,
        conModifier: 0,
        ac: 12,
        defenses: {
          resistances: [],
          vulnerabilities: [],
          immunities: [],
        },
        hitDice: [],
        spellSlots: {
          standard: {},
          pact: null,
        },
      },
      reason: "A goblin ambushes the party",
    },
    faces: [],
  },
  {
    fixture: "turn-mode-combat",
    batchId: "b-init",
    command: {
      type: "initiative.roll",
      participants: [
        {
          combatantId: "ana",
          mode: "normal",
        },
        {
          combatantId: "bram",
          mode: "normal",
        },
        {
          combatantId: "goblin",
          mode: "normal",
        },
      ],
      reason: "A goblin ambushes the party",
    },
    faces: [15, 12, 8],
  },
  {
    fixture: "turn-mode-combat",
    batchId: "b-ana-attack",
    command: {
      type: "attack.roll",
      attackerId: "ana",
      targetId: "goblin",
      expression: "1d20+4",
      mode: "normal",
      targetAc: null,
      reason: "Ana swings at the goblin",
    },
    faces: [14],
  },
  {
    fixture: "turn-mode-combat",
    batchId: "b-ana-damage",
    command: {
      type: "damage.apply",
      targetId: "goblin",
      components: [
        {
          amount: {
            kind: "fixed",
            value: 5,
          },
          damageType: "slashing",
        },
      ],
      critical: false,
      defenses: null,
      reason: "Ana's sword hits the goblin",
    },
    faces: [],
  },
  {
    fixture: "turn-mode-combat",
    batchId: "b-turn-1",
    command: {
      type: "turn.advance",
      reason: "Ana's turn ends",
    },
    faces: [],
  },
  {
    fixture: "turn-mode-combat",
    batchId: "b-bram-attack",
    command: {
      type: "attack.roll",
      attackerId: "bram",
      targetId: "goblin",
      expression: "1d6+2",
      mode: "normal",
      targetAc: null,
      reason: "Bram throws a handaxe",
    },
    faces: [],
    refusal: "D20_TERM_REQUIRED",
  },
  {
    fixture: "turn-mode-combat",
    batchId: "b-end",
    command: {
      type: "encounter.end",
      reason: "The goblin flees and the fight is over",
    },
    faces: [],
  },
  {
    fixture: "secret-tracker",
    batchId: "b-hidden-roll",
    command: {
      type: "roll",
      expression: "1d20+4",
      mode: "normal",
      reason: "Cult scout hides behind the altar",
    },
    faces: [11],
  },
];
