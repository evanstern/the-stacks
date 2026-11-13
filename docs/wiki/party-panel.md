---
name: party-panel
description: The play route's Party slide-out (TASK-0164, specs/072) - the header button, the PartyPanel rows built by partyRows (controller text, class and level, HP, AC, own-character marker), the Initiative list that reuses TurnOrder, and the class and level that scene start records on each party member.
kind: component
sources:
  - apps/web/app/play/party.ts
  - apps/web/app/play/components/party-panel.tsx
  - apps/web/app/play/components/table-header.tsx
  - apps/web/app/play/components/turn-order.tsx
  - apps/web/app/play/components/margin.tsx
  - packages/session-model/src/events/party.ts
  - apps/server/src/dm/nodes/resolve.ts
verified_against: cd1651916ec175a131a0dcd99f48590f7e96ab21
---

# Party panel

TASK-0164 (specs/072-party-slideout). Every viewer sees a "Party" button in `TableHeader` ([[play-route]]),
before "Ledger" (`partyOpen`, `onParty`, `aria-controls="party-panel"`). It opens `PartyPanel`
(`components/party-panel.tsx`) in the shared `Panel` ([[chat-ui]]) with id `party-panel`. No dialog.

## Rows

`party.ts`'s `partyRows(projections, present)` builds one `PartyRow` per party member:
`name`, `controller` text ("You", a display name, "Player (away)", "Player" or "AI companion"), `isAi`,
`isOwn`, `classLevel` ("Cleric 1", or null when either field is absent), HP and AC. The panel draws a
list named "Party"; the viewer's own character carries the badge "Your character", an AI character the
label "AI companion"; a null `classLevel` reads "Class and level not recorded".

## Initiative

`party.ts`'s `vitals(row)` (moved out of `party-panel.tsx` by TASK-0236, specs/090) builds the one vitals line - class and level, HP with temp, AC - that this panel and the table margin ([[play-route]]) both show.

A second list, named "Initiative", is `TurnOrder` ([[turn-floor]]) with `label="Initiative"` (its
default is "Turn order"), fed from the table view model's `order`.

## Where class and level come from

`PartyMemberSchema` (`packages/session-model/src/events/party.ts`) has optional `class` (up to 40
characters) and `level` (1 to 20). Scene start's `directorOpening` in `resolve.ts` writes both from the
seed character's `identity` onto each `director:party:<id>` row's `after` ([[seed-npc-presence]],
[[dm-runtime]]). Spec 099 also writes `side: "party"` on the engine combatant. A party member added any other way has neither, so its row reads "Class and level not recorded".

Spec 100: scene start now places each party combatant in the seed's start zone. The panel reads no placement; the projection holds it in `spatial` ([[session-model]]).
