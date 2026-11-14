# Implementation Plan: Dialogue knowledge

**Spec**: `specs/112-dialogue-knowledge/spec.md` | **Task**: TASK-0335 | **Date**: 2026-11-14
**Branch**: `task-0335-quoted-dialogue-leak` | **Prior spec**: `specs/103-prose-slots` (the check)

## Summary

Two snapshot fields carry the knowledge model: `met` (derived from the log) and `knows` (from seed
relationships). The narration check stops blanking quotes for actor and zone leaks and applies one
speech rule. The fiction and seat views drop unmet actors, so prompts never carry the names. The
auditor's hidden-info check calls the same speech function. No seed schema change, no migration,
no new dependency.

## Technical context

TypeScript, `apps/server` only. Pure functions plus one DB integration test. Vitest. Fake gateway.
The check stays pure and lexical (spec 103 D1): no model call.

## Constitution Check (3.0.0)

| Principle | Verdict | Note |
|---|---|---|
| I Agent-operable | Pass | No new surface. AI DM and companions use the same paths. No Intent kind is added. |
| II One Intent vocabulary | Pass | No world write changes. Talk replies stay prose slots. |
| III Event-sourced, hidden info | Pass (strengthens) | `met` is a projection of the log. Fewer unmet names reach public rows. OQ-2 (public `cast`) is a known gap, carded, not widened. |
| IV Three planes | Pass | Seed read through the existing loader. No cross-plane import. |
| V Many views, one state | Pass | `met` and `knows` live on the snapshot, a projection. No second store. |
| VI Engine owns numbers | N/A | No mechanics. |
| VII Narration around facts | Pass (strengthens) | The fiction-view filter withholds the leak source before narration (correct by construction). The check still runs after, appends a `dm` correction and never blocks. |
| VIII Campaign is data | Pass | Speaker knowledge is seed data (`hooks.relationships`). No prose reference added. |
| IX UX | Pass | No UI. Check cost is lexical, per sentence; the 1 s fact-row gate is unaffected (rows render before narration). |
| X-XIII | N/A | No library, content, hosting or JIT-plan change. |

Quality gates: fact-sheet tests and the hidden-information test rule (III, V) are served by the
replay tests in D6. No Complexity Tracking entry is needed.

## Design

### D1 — The knowledge model (snapshot)

`SnapshotActor` gains two fields, set in `buildSnapshot`:

- `met: boolean`. True when any holds:
  1. `kind === "party"`;
  2. logged presence is `present` or `yielded` (no entry counts as `present`);
  3. logged presence is `absent` and its reason is not `removed`;
  4. a public row with actor `ai:dm` of type `narration` or `talk` names the actor by a unique alias.
- `knows: string[]`: `[id, ...seedRelationshipTargets]`. NPC targets come from `npc.hooks.relationships`;
  a party actor's come from its seed character. Monsters: `[id]`.

Rule 4 reads `projections.transcript` (public `narration`/`talk` entries with `actor === "ai:dm"`).
Rule 4 runs after the alias lists are final, with `namedActorIds`. A companion's own talk does not
count: it is downstream of prompts this spec filters, and counting it would launder a leak.

ponytail: `removed` means "never introduced" only for scene-start seed rows (resolve.ts seed
presence group). A mid-scene `presence` effect with `removed` also reads as unmet. Upgrade to a
per-row `introduced` marker when a playtest shows a removed-after-met actor dropped from prompts.

`ActorSnapshot.v` stays 1: both fields are additive and only built in process. Test fixtures that
construct `SnapshotActor` literals add the two fields.

### D2 — The speech rule (narration check)

In `narration-check.ts`:

- `CheckInput` gains optional `speakerId?: string | null`.
- `CheckIssue.kind` gains `"unmet-actor"`.
- New exported pure function `speechLeaks(snapshot, text, speakerId)` returns
  `{ kind: "unmet-actor" | "fogged-zone"; actorIds; matched; inner: string; quoteStart }[]`.
  - Speech spans: each `"…"`/`“…”` interior (the same regex as `maskQuotes`). When `speakerId` is
    set and the text has no quote mark, the whole text is one span.
  - Speaker of a span: `speakerId` when set; else the last unique occurrence of any actor
    alias in the masked text before the span's start; else none.
  - For each unique alias occurrence in a span: leak when `!actor.met && !speaker?.knows.includes(actor.id)`.
  - For each fogged zone name in a span: leak.
  - `inner` is the sentence inside the span that holds the hit (split with the `sentencesOf` regex).
- `checkNarration` changes:
  - absent-actor loop: unchanged, still on `masked` (narrator prose only). When `speakerId` is set
    and the text has no quote, skip the absent-actor loop (the whole text is speech).
  - fogged-zone loop: unchanged on `masked`; speech zones come from `speechLeaks`.
  - per sentence, append each `speechLeaks` hit of that sentence as a `leak` issue with
    `sentence: raw` and a new optional `inner` field holding the inner sentence.
  - Life-state and dice-language stay on `masked`.
  - Detail texts: `"${name} has not met the party, and ${speaker} does not know them."` (or
    `"…and the speech has no known speaker."`); zone text unchanged.

### D3 — "Drop or correct the sentence"

`dropSentences(text, sentences)` gains an optional third arg `inners: ReadonlyMap<string, string[]>`
(sentence → inner sentences to cut). For a listed sentence with inners: remove each inner sentence
from inside its quote and collapse whitespace. If the quote interior is then empty, or the issue
has no inner, drop the whole sentence (today's behaviour). Callers build the map from issues with
an `inner`:

- `nodes/check.ts` (describe and ask), `talk-turn.ts` (reply and answer), `narration-stream.ts`
  (`describeKept`). One shared helper `dropPlan(issues)` in `narration-check.ts` returns
  `{ sentences, inners }` so the three callers stay one line each.

Corrections: `correctionsFor` is unchanged; `matched` already names the alias, so the `dm` row
reads `Correction (hidden): dropped "Snag" — …`.

Stream prefix property (spec 108): speech leaks are found per complete sentence, and inner cuts
apply to complete sentences only, so a streamed prefix still equals the final kept text's prefix.
Phase 2 re-runs the 106-fixture prefix test.

### D4 — Talk-turn speaker

`talk-turn.ts` `checked(text, speakerId?)`: the reply passes `react.speaker` when
`outcome === "reply"`; answer and confirm items pass none. The narrate node and stream pass none
(their quotes resolve a speaker by FR-006 attribution).

### D5 — Prompt filtering (AC #2)

- `snapshot/render.ts` `renderSnapshot`: for `view` `seat` and `fiction`, drop actors with
  `met === false` before rendering lines (and from the compressed path). `dm` unchanged.
  `characterSections` in `prompts/narrate.ts` maps lines by snapshot index; it must index the
  filtered actor list. Expose `visibleActors(snapshot, view)` from `render.ts` and use it there.
- `prompts/companion.ts`: Relationships line keeps only relationships whose `to` is a met actor in
  `snapshot`. Bump to `dm.companion-v10`.
- `prompts/react.ts` and `prompts/narrate.ts`: no code change beyond the version bump (they read
  the fiction view). Bump to `dm.react-v5`, `dm.narrate-v25`.
- The transcript sections are not filtered: after this spec, public DM rows carry only met or
  known names, and a name in a public DM row is met by rule D1.4.

### D6 — Tests (each phase owns its tests)

Replay fixture: `apps/server/test/dm/fixtures/r1-spine-0106e608.json`. The captured rows of session
`0106e608`, seqs 1-32, DM view, from vm-104 (read-only `psql`, 2026-11-13). The human user id
`6ff0a0f1-…` is replaced by `PLAYER_USER` from `snapshot-fixtures.ts`. Add the two react outputs:

- seq 21 (job `32112a98`, speaker `wenna`): `A voice cracks low from the ferry-house shadow, counting under breath — three, three, three — before Wenna Marsh steps into view, knuckles white on a boat-hook. "Who's walkin' my bank at dusk," she rasps, eyes darting to the cut rope swinging above. "Pell's not back. Snag's not back. You seen either, or you just come to gawk at an old woman's trouble?"`
- seq 30 (job `e5eb04d1`, speaker `wenna`): `Last I seen 'em — reeds past the bend, three days gone. Pell went for eel-traps, Snag followed grumblin'. Neither come back for supper, nor the one after. Water's loud there, swallows sound. I counted the hours — three, nine, twenty-seven — till I quit countin' and come lookin' myself. Found the rope cut 'fore I found them.`
- seq 22 (Odo, shipped): `Peace, goodwife, peace. We're no gawkers — we've come to see the ferry sing again. Pell and Snag, you say? A cut rope rarely cuts itself. Tell us where you last saw them, and we'll walk that bank with you.`

The Phase 1 implementer exports the rows with the read-only command in D7 and writes the fixture
with a `_header` naming the source, as `fixtures/run1-seq15-20-clarify.json` does. Rows the fixture
needs: 1-20 as captured; 21 and 30 with the shipped text; 22 as shipped. Payloads hold no secrets
(verified: no key or token fields).

The seq 30 replay folds the fixture with the corrected seq 21 text (Snag removed). With the original text, rule D1.4 would mark Snag met, which is the leak itself.

Changed existing cases (SC-005 exceptions):

- `narration-check.test.ts` "passes quotes, negation…": `'Tamsin shouts, "Pell, where are you?"'`
  keeps passing only because Tamsin's quote is a question to an actor the fixture marks met. Set
  the fixture actor `met: true` explicitly; add a twin case with `met: false` that leaks.
- Any fixture-built `SnapshotActor` literal gains `met` and `knows`.

### D7 — Evidence capture command (read-only)

```
ssh stacks@vm-104.local.infinity-node.win 'docker exec stacks-dev-db-1 sh -c "psql -U \$POSTGRES_USER -d \$POSTGRES_DB -Atc \"select json_agg(row_to_json(e) order by seq) from events e where session_id = '\''0106e608-e5f0-4ff9-89e2-16f780dbc002'\'' and seq <= 32\""'
```

Read-only per the vm-104 access rule. If ssh is unavailable to the implementer, build the fixture
from the texts in D6 plus `greyhollowFight()`-style scene-start rows, and mark it `reconstructed`.

### D8 — Auditor (localized)

`playtest/auditor/checks.ts`, inside the existing `if (ctx.seed)` hidden-info block only (TASK-0337
adds a check elsewhere in the file; keep the diff inside this block plus imports):

- For each public row of type `narration` or `talk` with actor `ai:dm`: build
  `buildSnapshot(project(ctx.transcript.filter(e => e.seq < row.seq), { role: "dm" }), ctx.seed)`,
  then `speechLeaks(snapshot, prose, null)` on the prose (`splitNarration(...).prose` for narration).
  Each hit adds `hidden-info` / `hidden-info-leak` at `row.seq` with detail
  `A public ${row.type} row names ${name} in speech; the party has not met them.` (or the zone).
- Import `project` from `@the-stacks/session-model`, `buildSnapshot` and `speechLeaks` from `../../dm/…`.

## Files

| File | Change | Phase |
|---|---|---|
| `apps/server/src/dm/snapshot/types.ts` | `met`, `knows` on `SnapshotActor` | 1 |
| `apps/server/src/dm/snapshot/build.ts` | derive `met`, `knows` (D1) | 1 |
| `apps/server/src/dm/narration-check.ts` | `speechLeaks`, `speakerId`, `unmet-actor`, `inner`, `dropPlan`, `dropSentences` inners (D2, D3) | 1 |
| `apps/server/src/dm/nodes/check.ts` | use `dropPlan` | 1 |
| `apps/server/src/dm/narration-stream.ts` | use `dropPlan` | 1 |
| `apps/server/src/dm/talk-turn.ts` | pass `react.speaker`; use `dropPlan` (D4) | 1 |
| `apps/server/test/dm/fixtures/r1-spine-0106e608.json` | new replay fixture (D6) | 1 |
| `apps/server/test/dm/dialogue-knowledge.test.ts` | new: snapshot `met`/`knows`, seq 21/30 check replay (FR-014) | 1 |
| `apps/server/test/dm/narration-check.test.ts` | D6 changed cases | 1 |
| `apps/server/test/dm/narration-stream.test.ts` | one quoted-leak prefix case | 1 |
| `apps/server/test/dm/talk-turn.integration.test.ts` | seq 21 reply via fake gateway (FR-017) | 1 |
| other `apps/server/test/**` snapshot literals | add `met`, `knows` (typecheck-driven) | 1 |
| `apps/server/src/dm/snapshot/render.ts` | `visibleActors`; seat/fiction drop unmet (D5) | 2 |
| `apps/server/src/dm/prompts/narrate.ts` | `characterSections` via `visibleActors`; `dm.narrate-v25` | 2 |
| `apps/server/src/dm/prompts/react.ts` | `dm.react-v5` | 2 |
| `apps/server/src/dm/prompts/companion.ts` | relationships filter; `dm.companion-v10` | 2 |
| `apps/server/test/dm/dialogue-knowledge-prompts.test.ts` | new: Odo and react prompts at seq 20 and corrected 21 (FR-015) | 2 |
| `apps/server/test/dm/{react-prompt,narrate,companion-addressee,talk-turn.integration,snapshot-render}.test.ts` | version strings, unmet-actor render cases | 2 |
| `apps/server/src/playtest/auditor/checks.ts` | speech finding in hidden-info block (D8) | 3 |
| `apps/server/test/playtest/checks.test.ts` | replay seq 21 original vs corrected (FR-016) | 3 |
| `docs/wiki/dm-narration-quality.md`, `actor-snapshot.md`, `dm-talk-triggers.md`, `playtest-harness.md`, `dm-runtime.md`, `output-claim-gate.md`, `seed-npc-presence.md`, `dm-turn-jobs.md`, `debug-view.md`, `CAPSULES.md`, `INDEX.md` | re-pin (Phase 4) | 4 |

Not touched: seed files and `seed/schema.ts` (no schema change), `apps/web/**` (the debug job card
prints `kind` as a string; `unmet-actor` renders with no change), frozen contracts.

## Migrations, prompts, dependencies

- Migrations: none.
- Prompt versions: `dm.companion-v10`, `dm.narrate-v25`, `dm.react-v5` (Phase 2).
- New runtime dependencies: none.

## Flags

- `cli/replay-checks.ts` calls `checkNarration` with no speaker; it compiles unchanged and gains
  speech checks for free. No edit.
- `nodes/narrate.ts` `withholdRefusedInputs` filters to `life-state` and `dm-only-text`; unaffected.

## Size and split check

Three code phases of one sonnet dispatch each plus the wiki phase. Phase 1 is the largest
(≈250 lines with tests). No split needed.
