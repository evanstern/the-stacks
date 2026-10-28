# Contract: the human DM's scene change on the play route

Binding for TASK-0159 (spec 055, ruled 2026-10-28, D-1 to D-7). Modules under `apps/web/app/play/`.
The gate request is the existing 029 `scene` kind. No 029 contract changes.

## Frame (`frames.ts`)

```ts
/** "Scene: <title>" sliced to 200 characters, or "Clear the scene". */
export function sceneSummary(after: SceneInput["after"]): string;

/** A `scene` gate request. Null when `reason` or `after` fails its schema. */
export function sceneFrame(input: SceneInput): EventFrame | null;
```

- `eventType: "scene"`, `payloadVersion: GATE_REQUEST_VERSION`.
- `payload: { reason, after, summary: sceneSummary(after), rationale: null }`.
- `reason` is trimmed and parsed with `ReasonSchema` (1 to 500 characters).
- `after` is null, or trimmed and parsed with `SceneSchema`: `title` 1 to 200, `summary` 0 to
  4000, `location` 0 to 200 with blank sent as `null`, `sceneId` a `RefIdSchema`.
- `closeProposalId` never reaches the payload.
- `localEventOf` does not map a `scene` frame. Fixture mode uses `localSceneEvents`.

## Command (`source.ts`, `use-live-table.ts`, `use-fixture-table.ts`, `local-log.ts`)

`TableCommands.changeScene(input: SceneInput): boolean`.

| Source | Behaviour |
|---|---|
| live | `ok = send(sceneFrame(input))`. When `ok` and `input.closeProposalId` is set, `send(rejectFrame(input.closeProposalId, null))`. Return `ok`. |
| fixture | `sceneFrame(input)` must be non-null. `localSceneEvents(project(events, dm), input)` builds one `scene.changed` row with `before` = `p.scene`; null when `before` and `after` are both null. Append it. When `closeProposalId` is set, decide it (the existing `decided` list). Return true. |

`localSceneEvents(p, input)` returns
`{ eventType: "scene.changed", payload: { reason, before: p.scene, after }, payloadVersion: currentVersion("scene.changed") }`
or null.

## Seeds (`scene-seeds.ts`)

`sceneChangeView(p, pendingIds)`; types in `plan.md` "Data model".

1. Candidates: `p.proposals` entries with `proposal.kind === "scene"` and `proposer === "ai:dm"`,
   any policy. Keep the last ten by `createdSeq`.
2. `pending`: candidates whose id is in `pendingIds`, oldest first. `earlier`: the rest, newest
   first.
3. A candidate with `after: null` is dropped when `p.scene` is null.
4. `current`: from `p.scene`, `origin: "current"`, `reason: ""`; null when `p.scene` is null.
5. `turnMode`: `p.tableMode.mode === "turn"`.
6. `empty`: `current` is null and there are no seeds.

`toTableViewModel` sets `sceneChange` to `sceneChangeView(p, new Set(input.proposals.map(id)))`
for a DM viewer, else null.

## Panel (`components/scene-panel.tsx`)

`ScenePanel({ view: SceneChangeView, onApply: (input: SceneInput) => boolean })`, rendered by
`TableView` inside the shared `Panel` (title "Change scene", id `SCENE_PANEL_ID`), only when
`model.sceneChange` is not null. No modal, no confirmation step.

- `empty`: the text "No scene to change yet. Start a scene, or wait for the AI DM's suggestion."
  and no form.
- Seed lists: headings "Suggestions" (`pending`) and "Earlier suggestions" (`earlier`). Each seed
  is a button named "Use: <label>". A `suggest` seed shows "Suggestion"; an `ask` seed shows
  "Proposal". The current scene is a button named "Use: Current scene".
- Form fields, by accessible name: "Scene id" (read-only text), "Scene title", "Scene summary",
  "Scene location", "Reason for the change", and a checkbox "Clear the scene" (shown only when a
  scene is set; it disables the scene fields).
- `turnMode`: the text "The table stays in turn mode."
- Button "Apply". It calls `onApply` with `closeProposalId` = the seed's `proposalId` when the seed
  is `pending`, else null. On `true` the form resets to the next seed. On `false` the draft stays.
- The initial seed is the oldest pending seed, else the current scene.

## Header (`components/table-header.tsx`)

`TableHeader` gains `sceneOpen: boolean` and `onScene?: () => void`. When `model.isDm` and
`onScene` is set, it renders a button named "Change scene" with `aria-controls={SCENE_PANEL_ID}`
and `aria-expanded={sceneOpen}`. Every other prop is unchanged, TASK-0163's `onStartScene` and
`startQueued` included.
