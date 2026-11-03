---
name: party-panel
description: The play route's Party slide-out (TASK-0164, specs/072) - the header button, the PartyPanel rows built by partyRows (controller text, class and level, HP, AC, own-character marker), the Initiative list that reuses TurnOrder, and the class and level that scene start records on each party member.
kind: component
sources:
  - apps/web/app/play/party.ts
  - apps/web/app/play/components/party-panel.tsx
  - apps/web/app/play/components/table-header.tsx
  - apps/web/app/play/components/turn-order.tsx
  - packages/session-model/src/events/party.ts
  - apps/server/src/dm/nodes/resolve.ts
verified_against: 938fb08c96c1ee21c6a7d227169506d810179294
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

A second list, named "Initiative", is `TurnOrder` ([[turn-floor]]) with `label="Initiative"` (its
default is "Turn order"), fed from the table view model's `order`.

## Where class and level come from

`PartyMemberSchema` (`packages/session-model/src/events/party.ts`) has optional `class` (up to 40
characters) and `level` (1 to 20). Scene start's `directorOpening` in `resolve.ts` writes both from the
seed character's `identity` onto each `director:party:<id>` row's `after` ([[seed-npc-presence]],
[[dm-runtime]]). A party member added any other way has neither, so its row reads "Class and level not recorded".
