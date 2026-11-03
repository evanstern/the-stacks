import {
  fixtureIds as ids,
  mechanicsBatch,
  numberRows,
  type SessionFixture,
} from "./build.js";

const sessionId = "00000000-0000-4000-8000-000000000102";

export const freeModeAction: SessionFixture = {
  name: "free-mode-action",
  description:
    "Free-mode play: a scene starts, Ana and Bram join the party with their engine combatants, Ana declares picking a lock, Bram comments, Ana commits as the declarer, one check roll resolves it, the action is marked applied, the DM narrates and a journal entry records the vault. Exercises the action status sequence, the party joined to engine HP, the ledger and the journal.",
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
      type: "scene.changed",
      payload: {
        reason: "The party reaches the vault door",
        before: null,
        after: {
          sceneId: "vault-door",
          title: "The vault door",
          summary:
            "A heavy iron door blocks the undercroft vault. Its lock is old but sound.",
          location: "Undercroft",
        },
      },
    },
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
        },
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
      actor: ids.companionActor,
      type: "action.commented",
      payload: {
        actionId: "act-lockpick",
        stance: "comment",
        text: "Take your time. I will watch the corridor.",
      },
    },
    {
      actor: ids.playerUserId,
      type: "action.committed",
      payload: {
        actionId: "act-lockpick",
        authority: "declarer",
      },
    },
    ...mechanicsBatch(
      { batchId: "b-lockpick", actor: ids.dmActor, actionId: "act-lockpick" },
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
      type: "narration",
      payload: {
        text: "The tumblers click one by one and the vault door swings inward.",
        actionIds: ["act-lockpick"],
      },
    },
    {
      actor: ids.dmActor,
      type: "journal.entry.added",
      payload: {
        entryId: "j-vault",
        title: "The vault opens",
        body: "Ana picked the lock on the undercroft vault door while Bram kept watch.",
        sourceActionIds: ["act-lockpick"],
      },
    },
  ]),
};
