---
name: scene-panels
description: The play route's two scene slide-outs - the operator Start scene panel (TASK-0163, specs/054; TASK-0167, specs/059: the server-derived scene start state, the hidden button and the queued and waiting notes; TASK-0177, specs/062: the client DM-seat issue) and the human DM's Change scene panel (TASK-0159, specs/055) - with the scene-seeds view, the scene gate request, the pending-seed reject that queues the next AI DM turn, and fixture-mode local events.
kind: component
sources:
  - apps/web/app/play/components/start-scene-panel.tsx
  - apps/web/app/play/start-scene.ts
  - apps/web/app/play/scene-seeds.ts
  - apps/web/app/play/components/scene-panel.tsx
  - apps/web/app/play/frames.ts
  - apps/web/app/play/local-log.ts
verified_against: 68115fdd4cca3cfcb41f7052b408fd2eef27b9cd
---

# Scene panels

Both panels sit in `components/panel.tsx`'s `Panel` ([[chat-ui]]) and open from `TableHeader`
([[play-route]]). Neither is a modal.

## Start scene

TASK-0163 (specs/054), amended by TASK-0167 (specs/059). The server decides whether a start is
possible: `sceneStartState` (`apps/server/src/dm/scene-start.ts`) returns `started`, `queued`,
`pending` or `none`, and `GET /dm/sessions/:id/start` returns `{ state }` ([[dm-runtime]]).
`useLiveTable` fetches it (`fetchStartState`, `start-scene.ts`) for an operator once caught up
and exposes it as `TableSource.sceneStart` (`SceneStartView`: those four plus `unknown`; a
non-operator or fixture source has none). While the view is `queued` or `pending` the hook polls
every 5 s (`shouldPollStart`); a failed fetch reads as `none`, and the POST's 409 is the backstop.
`TableView` sets `canStart` only for a live source whose `role` is `operator`, once caught up,
with no scene (`model.scene === null`), `sceneStart === "none"` and `startScene` present. So the
"Start scene" button (`aria-controls` the panel id) is hidden while a start is in flight. While
no scene exists and the view is `queued` or `pending`, `TableHeader` shows a note instead
(`startNote`): "Scene start queued." or "Scene start waiting for the DM." (a human DM has not yet
carried out the suggestion). `TableView` holds no start flag, and `StartScenePanel` has no
`onQueued`; a 202 sets the view to `queued` (`nextStartView`) and the poll follows. The button opens
`components/start-scene-panel.tsx`'s `StartScenePanel`, a `Panel` slide-out. On open it calls
`fetchSeeds` (`start-scene.ts`, `GET /dm/seeds`) and picks the first seed. It shows a select of
the present users per human seat and, only when the seed has companion seats, a note naming the AI companions (the trio seed, `greyhollow-ford-trio`, shows three selects and no note; TASK-0176). Pure
helpers: `seatMapIssues(humans, seats, dmUserId?)` (an empty seat, a user in two seats, and, when `dmUserId` is set, the DM on a character seat: "The DM cannot hold a character seat."), `startBody`, `issuesBySeat`. `useLiveTable` wires
`startScene` to `postStart`, `POST /dm/sessions/:id/start`; a 202 closes the panel and refreshes the state; `StartScenePanel` takes `dmUserId` (TASK-0177, specs/062; the human DM's id, else null) from `TableView`; `StartSceneForm` shows the client DM-seat issue on that seat unless the server already sent the same one, and the form is not ready while it stands. A 400 shows its issues inline, any other refusal its message ([[dm-runtime]]).

## Change scene

TASK-0159 (specs/055, decisions D-1 to D-7). The seated human DM changes the scene from the table.
`toTableViewModel` sets `sceneChange` (a `SceneChangeView`, built by `scene-seeds.ts`'s
`sceneChangeView`) only when `isDm`; a player gets `null`. `TableHeader` then shows a "Change
scene" button (`aria-controls` `SCENE_PANEL_ID`) that opens `components/scene-panel.tsx`'s
`ScenePanel` in a `Panel` slide-out. The panel lists seeds: each pending `ai:dm` scene proposal
(oldest first), each decided one among the last ten scene proposals (newest first), and the
current scene. Any policy (`suggest` or `ask`) seeds. `draftFor` and `initialDraft` copy a seed's
title, summary, location and reason into the form; the oldest pending seed wins, else the current
scene. The DM edits title, summary, location and reason. `sceneId` is read-only and always comes
from the seed (`applyInput`), so the AI DM loads the same seed on its next turn. "Clear the scene"
sends `after: null`. In turn mode the panel adds "The table stays in turn mode." (the Table mode slide-out in [[play-route]] ends the encounter or switches to free mode) With no scene and
no seed it shows "No scene to change yet. Start a scene, or wait for the AI DM's suggestion." and
no form. A seed that clears a scene is hidden while no scene is set (the gate refuses it).

Apply calls `commands.changeScene(SceneInput)`. Live (`use-live-table.ts`) sends `sceneFrame`
(`frames.ts`: schema-checked, `eventType: "scene"`, a summary from `sceneSummary`), then, when the
seed is a pending proposal, `rejectFrame(closeProposalId, null)`. The reject closes the source
suggestion, and a `proposal.rejected` row on an `ai:dm` proposal queues the next AI DM turn, which
a direct `scene.changed` row does not ([[dm-turn-jobs]]). A decided seed closes nothing. Fixture
mode (`use-fixture-table.ts`) appends `localSceneEvents` (`local-log.ts`) and the matching
`proposal.rejected` row. The panel closes when the send succeeds. The approvals list still offers
Dismiss on a suggestion; Dismiss alone leaves no scene and the AI DM stops at `no-scene`.

Related: [[play-route]], [[dm-runtime]], [[proposal-gate]], [[seed-npc-presence]].
