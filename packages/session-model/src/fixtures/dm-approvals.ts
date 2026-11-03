import {
  fixtureIds as ids,
  mechanicsBatch,
  numberRows,
  type SessionFixture,
} from "./build.js";

const sessionId = "00000000-0000-4000-8000-000000000106";

const vaultScene = {
  sceneId: "vault-door",
  title: "The vault door",
  summary:
    "A heavy iron door blocks the undercroft vault. Its lock is old but sound.",
  location: "Undercroft",
};

export const dmApprovals: SessionFixture = {
  name: "dm-approvals",
  description:
    "A human DM takes the seat and the gate supervises the AI DM. The DM seats themselves, sets the scene and party directly, and raises the journal policy to ask. Ana declares and commits a lockpick. Five AI DM proposals follow: an approved check roll whose effects land before its approval, a rejected narration, and three left pending (a scene suggestion, a hidden tracker and a table-mode change). Exercises the proposals projection, the gate view, DM-only delivery and the approval panel.",
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
      actor: ids.dmUserId,
      type: "dm.seat.changed",
      payload: {
        reason: "A human takes the DM seat",
        before: { kind: "ai" },
        after: { kind: "human", userId: ids.dmUserId },
      },
    },
    {
      actor: ids.dmUserId,
      type: "scene.changed",
      payload: {
        reason: "The party reaches the vault door",
        before: null,
        after: vaultScene,
      },
    },
    ...mechanicsBatch({ batchId: "b-add-ana", actor: ids.dmUserId }, [
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
    ...mechanicsBatch({ batchId: "b-add-bram", actor: ids.dmUserId }, [
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
    {
      actor: ids.dmUserId,
      type: "party.member.changed",
      payload: {
        reason: "Ana joins the party",
        characterId: "ana",
        before: null,
        after: {
          characterId: "ana",
          name: "Ana",
          controller: { kind: "player", userId: ids.playerUserId },
          combatantId: "ana",
        },
      },
    },
    {
      actor: ids.dmUserId,
      type: "party.member.changed",
      payload: {
        reason: "Bram joins the party",
        characterId: "bram",
        before: null,
        after: {
          characterId: "bram",
          name: "Bram",
          controller: { kind: "ai-companion", actor: ids.companionActor },
          combatantId: "bram",
        },
      },
    },
    {
      actor: ids.dmUserId,
      type: "gate.policy.changed",
      payload: {
        reason: "Journal entries need a look before they land",
        proposalKind: "journal",
        before: "auto",
        after: "ask",
      },
    },
    {
      actor: ids.playerUserId,
      type: "action.declared",
      payload: {
        actionId: "act-lockpick",
        characterId: "ana",
        scope: "character",
        text: "Ana picks the lock on the vault door.",
      },
    },
    {
      actor: ids.playerUserId,
      type: "action.committed",
      payload: { actionId: "act-lockpick", authority: "declarer" },
    },
    {
      actor: ids.dmActor,
      type: "proposal.created",
      visibility: "dm",
      payload: {
        proposalId: "prop-1",
        policy: "ask",
        proposal: {
          kind: "mechanics",
          summary: "Ana: DC 15 lockpick",
          rationale:
            "Ana committed to picking the lock; a Dexterity check decides it.",
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
          actionId: "act-lockpick",
          visibility: "public",
        },
      },
    },
    ...mechanicsBatch(
      {
        batchId: "b-lockpick",
        actor: ids.dmActor,
        actionId: "act-lockpick",
        proposalId: "prop-1",
      },
      [
        {
          type: "dice.rolled",
          v: 1,
          reason: "Ana picks the vault lock",
          expression: "1d20+5",
          mode: "normal",
          purpose: "check",
          critical: false,
          combatantId: "ana",
          terms: [
            {
              kind: "dice",
              sign: 1,
              count: 1,
              sides: 20,
              keep: null,
              faces: [13],
              kept: [true],
              subtotal: 13,
            },
            {
              kind: "modifier",
              value: 5,
            },
          ],
          total: 18,
          natural: 13,
        },
        {
          type: "check.resolved",
          v: 1,
          reason: "Ana picks the vault lock",
          combatantId: "ana",
          kind: "ability-check",
          ability: "dex",
          skill: null,
          dc: 15,
          rollIndex: 0,
          total: 18,
          natural: 13,
          autoFail: null,
          outcome: "success",
          margin: 3,
          band: "success",
        },
      ],
    ),
    {
      actor: ids.dmUserId,
      type: "proposal.approved",
      visibility: "dm",
      payload: { proposalId: "prop-1", batchId: "b-lockpick" },
    },
    {
      actor: ids.dmActor,
      type: "action.resolved",
      payload: {
        actionId: "act-lockpick",
        outcome: "applied",
        batchIds: ["b-lockpick"],
        refusalCode: null,
      },
    },
    {
      actor: ids.dmActor,
      type: "proposal.created",
      visibility: "dm",
      payload: {
        proposalId: "prop-2",
        policy: "ask",
        proposal: {
          kind: "narration",
          summary: "Narrate the door swinging open",
          rationale:
            "The check succeeded; the table needs the result described.",
          narration: {
            text: "The tumblers click one by one and the vault door swings inward.",
            actionIds: ["act-lockpick"],
          },
          visibility: "public",
        },
      },
    },
    {
      actor: ids.dmUserId,
      type: "proposal.rejected",
      visibility: "dm",
      payload: {
        proposalId: "prop-2",
        reason: "I will describe the vault myself.",
      },
    },
    {
      actor: ids.dmActor,
      type: "proposal.created",
      visibility: "dm",
      payload: {
        proposalId: "prop-3",
        policy: "suggest",
        proposal: {
          kind: "scene",
          summary: "Move the party into the vault",
          rationale: "The door is open and the party is ready to enter.",
          reason: "The party steps through the open door",
          after: {
            sceneId: "vault-interior",
            title: "Inside the vault",
            summary: "Shelves of dusty crates line a low stone room.",
            location: "Undercroft",
          },
        },
      },
    },
    {
      actor: ids.dmActor,
      type: "proposal.created",
      visibility: "dm",
      payload: {
        proposalId: "prop-4",
        policy: "ask",
        proposal: {
          kind: "tracker",
          summary: "Start the hidden alarm tracker",
          rationale:
            "A trapped crate will raise an alarm the party cannot see.",
          reason: "The vault is trapped",
          trackerId: "vault-alarm",
          after: {
            trackerId: "vault-alarm",
            name: "The vault alarm",
            segments: 4,
            filled: 1,
            note: null,
          },
          visibility: "dm",
        },
      },
    },
    {
      actor: ids.dmActor,
      type: "proposal.created",
      visibility: "dm",
      payload: {
        proposalId: "prop-5",
        policy: "ask",
        proposal: {
          kind: "table-mode",
          summary: "Switch to turn mode, Ana first",
          rationale: "Guards are coming; initiative order matters now.",
          reason: "Guards arrive",
          after: {
            mode: "turn",
            activeActor: ids.playerUserId,
            activeCharacterId: "ana",
          },
        },
      },
    },
  ]),
};
