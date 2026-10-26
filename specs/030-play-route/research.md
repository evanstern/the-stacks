# Research: play route (TASK-0047)

Each entry: Decision, Rationale, Alternatives rejected. No entry left NEEDS CLARIFICATION.

## R1. Routes and URLs

**Decision.** Three client-only routes in `apps/web/app/routes.ts`:

| Path | Module | Purpose |
|---|---|---|
| `play/:sessionId` | `routes/play.tsx` (rewritten) | The live table |
| `play/fixtures` | `routes/play-fixtures.tsx` (new) | Operator-only list of the committed fixtures |
| `play/fixtures/:fixtureName` | `routes/play-fixture.tsx` (new) | One fixture rendered as a table |

The fixture table reads two query parameters: `as` (`dm`, or a player user id from the fixture's
`viewers.players`; default `dm`) and `through` (a seq; default the last seq). React Router ranks
the static `fixtures` segment above `:sessionId`, so the routes do not collide. The Table landing
(`routes/table.tsx`) gains an operator-only "Preview fixtures" link.

**Rationale.** A URL per fixture, viewer and point in the stream makes every screenshot and test
reproducible by address. A query string keeps the viewer and step out of the route tree.

**Alternatives rejected.** A fixture toggle inside the live route (mixes a dev surface into the
live URL space and makes AC #7's "same components" harder to show). A Storybook-style harness (a
new dependency, and not the app's real shell).

## R2. One table view, one source seam (AC #7)

**Decision.** Both table routes render `<TableView source={…} />` and nothing else from the play
component set. A `TableSource` (contracts/table-source.md) carries the viewer, the visible events,
the connection status, the pending proposals and a `TableCommands` object. Two hooks build it:
`useLiveTable(sessionId, user)` and `useFixtureTable(fixture, viewer, through)`. `TableView`
derives everything else through one pure function, `toTableViewModel(projections, input)`.

**Rationale.** AC #7 is provable when the only difference between modes is the source object. A
test can then feed one event list through both hooks' event paths and compare the view models and
the rendered markup.

**Alternatives rejected.** Passing projections instead of events (the live source would then own a
fold the fixture source repeats; two folds is two chances to diverge).

## R3. Folding on the client

**Decision.** `TableView` computes `project(source.events, source.viewer)` from
`@the-stacks/session-model` inside `useMemo`, keyed on the events array and the viewer. The live
hook appends to its events array immutably (as `useSession` does today), so the memo recomputes per
delivered event.

**Rationale.** `project` is pure, total and the same function the server and the DM runtime use
(constitution IV: client state is a projection of the log). A First Scene log holds hundreds of
events; a full fold per event is well under a frame.

**Alternatives rejected.** An incremental fold held in a ref (correct only while the viewer and the
event list never change identity; the fixture mode changes both).

## R4. Who the viewer is

**Decision.** Live: the root loader's user maps to a `Viewer`. Role `operator` → `{ role: "dm" }`;
role `player` → `{ role: "player", userId: user.id }`. The viewer's actor id is `user.id` in both
cases. Fixture: the `as` parameter selects one of `fixture.viewers`; the DM's actor id is
`fixtureIds.dmActor`, a player's is their user id.

**Rationale.** specs/028-session-model Assumptions: the M2 DM viewer is the operator role.

## R5. Live writes before TASK-0045

**Decision.** `useSession` gains `sendEvent({ eventType, payload, payloadVersion, visibility? })`
in place of `send(text)` (its only caller is `routes/play.tsx`). The live `TableCommands` build each
frame with a pure builder in `play/frames.ts` and parse the payload with the session-model schema
(`TalkV1`, `ActionDeclaredV1`, `ActionCommentedV1`, `ActionCommittedV1`) before sending; a payload
that fails its schema is not sent. Frames are listed in contracts/live-frames.md. Action ids are
`act-` plus `crypto.randomUUID()` (matches `RefIdSchema`).

**Rationale.** The M0 `send` frame already records any event type with the authenticated actor;
TASK-0044 left the WebSocket path unchanged. Validating on the client keeps the route from writing
rows the fold would count as invalid. The PR stays draft until TASK-0045 merges, so unchecked
commits never reach `main` (runbook, lane 3).

**Alternatives rejected.** Waiting for TASK-0045 to build any live path (blocks AC #7 evidence and
leaves the live adapter untested until the end).

## R6. Commit authority on the client

**Decision.** A pure `commitAuthorityFor(action, tableMode, viewer, party)` in `play/authority.ts`
returns `{ canCommit: true, authority } | { canCommit: false, holder }`:

1. A status other than `declared` or `discussed` → no control, holder `null`.
2. DM viewer → `authority: "dm"`.
3. Party-scope action, player viewer controlling at least one party member → `authority: "group"`
   (decision-0016 consequences: with one human, group sign-off is that player; TASK-0049 adds
   multi-player sign-off).
4. Turn mode → the viewer commits as `active-player` only when `tableMode.activeActor` equals the
   viewer's user id and the action's actor equals it too. Holder otherwise: the active actor.
5. Free mode → the viewer commits as `declarer` only when the action's actor equals the viewer's
   user id. Holder otherwise: the declaring actor.

**Rationale.** decision-0016's table, row by row. The gate enforces (TASK-0045 AC #6); the route
only decides what to show.

**Gated-phase rule.** If TASK-0045 exports its authority rule from a client-importable package, the
gated phase replaces this module's body with a call to it and keeps the tests.

## R7. Ledger before/after display

**Decision.** `play/ledger-format.ts`'s `changedFields(before, after)` walks both values to depth 3
and returns `{ path, before, after }` for every leaf whose JSON differs. A `null` side renders as
"none". Arrays compare as whole JSON strings at their path. Rolls render reason, expression, every
die face (dropped faces struck through via `kept`), total and natural. Outcomes render reason and a
one-line result (hit or miss, success or failure, rest kind).

**Rationale.** A `combatant.added` after-value is a large object; listing changed leaves shows
"hp.current 7 → 2" instead of two JSON blobs.

## R8. The proposal seam

**Decision.** contracts/proposal-seam.md. The approval panel and the approval control depend only on
`PendingProposalView[]` and `ProposalCommands`. Before TASK-0045: the fixture source supplies the
web-local examples in `play/fixtures/proposals.ts` (DM viewer only); the live source supplies `[]`
and its commands return `false`. The gated phase supplies a `selectPendingProposals(events, viewer)`
mapping TASK-0045's proposal events or projection, and live commands calling TASK-0045's approve
and reject interface.

**Rationale.** TASK-0045 is specified in parallel; its types are not visible. Freezing the view
shape here lets the panel build and test now, and confines the gated phase to one adapter module.

## R9. Testing

**Decision.**
- Pure modules (`play/*.ts`) are erasable TypeScript, tested with `node:test` from `.test.mjs`
  files, as `ask/turns.ts` is today. They may import `@the-stacks/session-model` at runtime (built
  `dist`, which turbo builds before `test`).
- Components (`.tsx`) are tested with `vitest` and `react-dom/server`'s `renderToStaticMarkup`, no
  DOM library. `vitest` is added to `apps/web` `devDependencies` at `^5.0.1`, the version five
  workspace packages already use. Files are `test/play/*.test.tsx`, which `node --test` does not
  collect. The `test` script becomes `node --test && vitest run`.
- Panel bodies (`LedgerList`, `ProposalList`) are exported components so a test renders them
  without opening a Sheet (Radix portals do not render on the server).

**Rationale.** Node strips types but cannot compile JSX. `vitest` is already resolved in the
lockfile, so nothing new is downloaded; it is a dev dependency only.

**Alternatives rejected.** jsdom plus Testing Library (two new packages). Pure-module tests only
(no proof that the markup carries the commit control or hides proposals from players).

## R10. No modals (AC #6)

**Decision.** Three checks. The existing `test/no-dialog.test.mjs` already greps all of `app/` for
`<dialog`, `showModal` and `AlertDialog`, and confines the word `Dialog` to `ui/sheet.tsx`. A new
`test/play-surfaces.test.mjs` asserts that only `components/panel.tsx` imports
`components/ui/sheet`, and that no file under `app/play/` contains `fixed inset-0` (a centred
overlay). A vitest render test asserts the closed-panel `TableView` markup has no `<dialog` and no
`aria-modal`. Choices use inline segmented controls (radio groups); no new dropdown component is
needed.

## R11. Client-only (AC #8)

**Decision.** All three new or rewritten routes export `clientLoader` and `HydrateFallback` and no
`loader`. `test/ssr.test.mjs` asserts that `/play/<uuid>`, `/play/fixtures` and
`/play/fixtures/free-mode-action` return the fallback and none of the table's markup.

## R12. Loading fixtures

**Decision.** `play-fixture.tsx`'s `clientLoader` dynamically imports
`@the-stacks/session-model/fixtures`, so fixture data is its own chunk and loads only on that route.
A non-operator gets `OperatorOnly` with "The fixture table is available to the operator only."

## R13. Fixture commands

**Decision.** `play/local-log.ts`'s `appendLocal(events, input, actor)` returns a new array with one
`StoredEvent`: `seq` = last seq + 1, `ts` = last `ts` + 1 second (no clock read), `visibility`
`public`. Approve and reject remove the proposal from the page's local list. Stepping (`through`)
applies to the fixture's own events; local appends come after the step point and are dropped when
the step changes.

## R14. Visual language

**Decision.** The chat-ui decision applies unchanged: Daylight tokens from `app.css`, the shared
`Panel` (right on desktop, bottom sheet under `narrow:`), header triggers styled like the Sources
button (leading icon, trailing chevron that turns when open, border, hover and pressed states,
`aria-expanded`, `aria-controls`), inline SVG icons in `components/icons.tsx`, `system-ui` font, AA
contrast in both modes (`test/contrast.test.mjs` covers any new token).

## R15. Brave evidence

**Decision.** `specs/030-play-route/evidence/shoot.mjs` drives Brave with out-of-tree
`playwright-core` (`executablePath` = the Brave binary; never added to any `package.json`, as
specs/024 did). It captures 1280 px and 390 px, light and dark, for: the free-mode fixture as the
player with an open action; the turn-mode fixture stepped to Ana's turn; the ledger panel; the
approval panel as the DM. Live evidence: `evidence/seed-live.mjs` copies a fixture's rows into a
fresh session on the worktree stack (mapping fixture player ids to the seeded player's real id),
then the shoot script opens it as the player and the DM in two contexts and drives talk, declare,
comment and commit through the UI. Files land in `specs/030-play-route/evidence/shots/` and attach
to the PR.

## R16. The gated phase (after TASK-0045 merges)

**Decision.** One phase, one dispatch, started only when `gh api …/pulls/<0045 PR> --jq .merged`
returns `true`:
1. Merge `origin/main` into the branch (never rebase).
2. Implement `selectPendingProposals` against TASK-0045's proposal events or projection.
3. Wire live approve and reject to TASK-0045's interface; wire live writes through its binding
   player-action path if it changed the `send` path.
4. Adopt TASK-0045's authority rule if it is client-importable (R6).
5. If TASK-0045 added proposal fixtures, derive fixture-mode proposals from them and delete
   `play/fixtures/proposals.ts`.
6. Prove the DM's live connection receives pending proposals; take the live Brave screenshots,
   including an approval.
7. `pnpm ci:check` green.

**Rationale.** The runbook holds this PR as draft until TASK-0045 merges; this phase is what the
hold waits for.
