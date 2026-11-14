# Feature Specification: Dialogue knowledge (who a speaker and the party know)

**Feature**: `specs/112-dialogue-knowledge` | **Task**: TASK-0335 | **Created**: 2026-11-14
**Status**: Draft (authored for the R1 sweep, `docs/design/r1-fast-table-runbook.md` Amendment 2026-11-13)
**Evidence**: `docs/playtests/2026-11-13-r1-spine-test-drive.md` findings 4 and 7 (session `0106e608`,
seqs 13-32, read-only from vm-104 `stacks-dev-db-1` and quoted in plan D7).
**Clarify**: skipped. The card, the two findings and the operator ruling settle scope; the one
judgment call (the knowledge model) is settled in this spec. Residual items are Open questions.

## Summary

The spec 103 narration check blanks quoted text before its absent-actor and fogged-zone checks.
So NPC dialogue ships hidden information: Wenna says "Snag's not back." (seq 21), although the
party never met Snag and the seed never gives Wenna knowledge of him. Odo then repeats "Pell and
Snag" (seq 22). The inverse also happens: an unquoted reply in Wenna's voice names her grandson
Pell, and the check drops it as "absent and the prose shows them" (seq 30-31). The playtest
auditor's hidden-info check passed the same segment.

This spec adds one small knowledge model and applies it in four places:

- **Met** (the party side): an actor the party has met. Derived from the log.
- **Knows** (the speaker side): actors a speaker knows. Read from the seed's existing
  `hooks.relationships`.
- **Speech rule**: quoted speech (and a reply spoken by a named speaker) may name an actor only when
  the party has met that actor or the speaker knows them. Speech may never name a fogged zone.
- The runtime check, the companion and talk prompts, and the auditor all read the same rule.

## Acceptance criteria map

| Card AC | Covered by |
|---|---|
| #1 The leak check runs on quoted NPC dialogue for absent and unmet actors and hidden zones, and drops or corrects the sentence, with a test built from this transcript. | US1, US2, FR-001 to FR-009, FR-014, SC-001, SC-002 |
| #2 Companion prompts receive no actor name the party has not met, with a test. | US3, FR-010 to FR-012, FR-015, SC-003 |
| Runbook ruling "Approved, but automate the tests": each fix adds a test that replays the test-drive flow. | FR-014 to FR-016, SC-001 to SC-004 |
| Card note: fix the auditor alongside the runtime check. | US4, FR-013, FR-016, SC-004 |

## User scenarios

### US1 — Dialogue cannot reveal an actor the party has not met (P1, AC #1)

A player explores Greyhollow Ford. Wenna answers in a talk-turn reply.

1. **Given** the greyhollow-ford scene start (Pell and Snag absent, reason `removed`), **When** the
   reply is seq 21's text with speaker `wenna`, **Then** the shipped narration keeps
   `"Pell's not back. You seen either, or you just come to gawk at an old woman's trouble?"` and
   drops the inner sentence `Snag's not back.`
2. **Then** one `dm` correction row names the dropped text and says why. No correction names Pell.
3. **Given** a quote that names the Loft (a fogged zone), **Then** that inner sentence drops.

### US2 — A speaker may name an actor they know (P1, AC #1, finding 7)

1. **Given** the state after the corrected seq 21 shipped, **When** the reply is seq 30's text with
   speaker `wenna` (no quote marks), **Then** the sentence `Pell went for eel-traps, Snag followed
   grumblin'.` drops for naming Snag, and no issue names Pell.
2. **Given** a reply that names only Pell in Wenna's voice, **Then** nothing drops.
3. **Given** unquoted narrator prose that shows absent Pell on screen ("Pell steps out of the
   reeds."), **Then** the spec 103 absent-actor drop is unchanged.

### US3 — Companions hear only names the party has met (P1, AC #2)

1. **Given** the scene-start state through seq 20, **When** Odo's companion prompt is built,
   **Then** the prompt contains no alias of Snag or Pell.
2. **Given** the corrected seq 21 in the transcript, **When** Odo's prompt is built, **Then** it
   names Pell (Wenna named him in public) and still no alias of Snag.

### US4 — The auditor flags a quoted leak the runtime would drop (P2, card note)

1. **Given** the test-drive transcript with the original seq 21 text, **When** the auditor runs
   checks only, **Then** `hidden-info` fails with a finding at seq 21 that names Snag and not Pell.
2. **Given** the corrected seq 21 text, **Then** `hidden-info` passes on that segment.

### Edge cases

- A quote with no attributable speaker: only the met rule applies (strict).
- A speaker's own name inside their quote: allowed (a speaker knows themself).
- A party character's quote: the speaker's knows set is that character's seed relationships.
- An unclosed quote while streaming: the spec 108 hold is unchanged. The speech rule runs on
  complete sentences only, so the stream's prefix property holds.
- Every inner sentence of a quote drops: the whole containing sentence drops.
- A departed actor (left this beat) is met, so speech may name them.
- An actor removed mid-scene by a `presence` effect with reason `removed`: treated as unmet
  (ponytail, plan D1).
- Life-state and dice-language checks keep masking quotes (a character may be wrong about a death).
- DM-only seed text inside a quote still leaks (that check already reads raw text).

## Requirements

### Functional requirements

**Knowledge model**

- **FR-001** Each snapshot actor carries `met: boolean`. The party has met an actor when any of
  these holds: the actor is a party member; its logged presence is `present` or `yielded`; its
  logged presence is `absent` with a reason other than `removed`; or a public `ai:dm` narration or
  talk row before the snapshot names it by a unique alias.
- **FR-002** Each snapshot actor carries `knows: string[]`: its own id plus the `to` ids of its seed
  `hooks.relationships` (NPCs and characters). Actors with no seed entry know only themselves.
- **FR-003** No seed schema change. No new seed field. The knowledge source is the existing
  `relationships` list.

**Runtime check (AC #1)**

- **FR-004** The leak check reads quoted text for actor and zone leaks. It no longer blanks quotes
  for those two checks. Life-state and dice-language checks still blank quotes.
- **FR-005** Speech is: each quote's interior; and, when the check has an explicit speaker and the
  text holds no quote mark, the whole text.
- **FR-006** A speech's speaker is the explicit speaker when the caller passes one. Otherwise it is
  the last unique actor alias (party included) that occurs outside quotes before that quote in the same
  text. Otherwise the speaker is unknown.
- **FR-007** Speech that names an actor by a unique alias leaks (new kind `unmet-actor`) unless the
  actor is met or is in the speaker's `knows`. Speech that names a fogged zone leaks (kind
  `fogged-zone`). Speech is exempt from the absent-actor rule.
- **FR-008** A speech leak corrects the sentence: it drops each leaking inner sentence of that
  quote and keeps the rest. When a quote has no inner sentence left, or the speech is the whole
  text, the sentence drops. Each leak appends one `dm` correction row, as spec 103 does.
- **FR-009** The talk-turn reply passes its `speaker` as the explicit speaker. The narrate node, the
  ask_dm answer and confirm items pass none.

**Prompts (AC #2)**

- **FR-010** The `seat` view (companion) and the `fiction` view (narrate, react) of the snapshot
  omit every actor whose `met` is false. The `dm` view (director) is unchanged.
- **FR-011** The companion prompt's Relationships line omits a relationship whose target actor is
  not met.
- **FR-012** The prompt versions bump: `dm.companion-v10`, `dm.narrate-v25`, `dm.react-v5`.

**Auditor (card note)**

- **FR-013** The auditor's `hidden-info` check adds a speech finding: for each public `ai:dm`
  narration or talk row, it builds the snapshot at that row and applies the FR-006/FR-007 rule with
  no explicit speaker. A hit is a `hidden-info-leak` finding at that seq.

**Automated replay tests (operator ruling)**

- **FR-014** A pure test replays the test-drive flow through the check: seq 21 and seq 30 react
  texts against the scene-start state, with the expected shipped text and issues of US1 and US2.
- **FR-015** A pure test replays the flow through the companion and react prompt builders (US3).
- **FR-016** A pure test replays the test-drive transcript through the auditor (US4).
- **FR-017** A DB talk-turn integration test ships seq 21's react text through the fake gateway
  and asserts the shipped narration row and the `dm` correction row (US1).

### Constitution-driven requirements

- **III (hidden information)**: no public row and no player-facing prompt names an unmet actor
  that the speaker does not know.
- **VII (narration around facts)**: the check runs after narration, appends a correction and never
  blocks play. The fiction-view filter removes the leak source before narration (correct by
  construction); the check stays as the second line.
- **VIII (campaign is data)**: speaker knowledge is seed data (`relationships`), not prompt prose.

### Key entities

- **Met**: a per-actor flag on the snapshot, derived from presence rows and public DM rows.
- **Knows**: a per-actor id list on the snapshot, from seed relationships.
- **Speech**: a quote interior, or a whole reply with an explicit speaker and no quotes.

## Success criteria

- **SC-001** The seq 21 replay ships `Pell's not back.` and not `Snag's not back.`; one `unmet-actor`
  issue names Snag.
- **SC-002** The seq 30 replay raises no issue that names Pell (finding 7 fixed) and drops the
  sentence that names Snag.
- **SC-003** Odo's prompt at seq 20 and at corrected seq 21 contains zero aliases of Snag.
- **SC-004** The auditor fails `hidden-info` at seq 21 on the original transcript and passes it on
  the corrected one.
- **SC-005** Every existing narration-check, stream, check-node, talk-turn and auditor test still
  passes, except cases this spec deliberately changes (listed in plan D6).

## Assumptions

- A seed author lists in `relationships` the people an NPC knows by name. Greyhollow-ford's Wenna
  lists Pell and not Snag, which matches the evidence.
- Naming an actor the party has met reveals nothing new, so speech may name a met actor freely.
- The talk-turn `speaker` field is the reply's voice (the react prompt requires it for `reply`).

## Open questions

- **OQ-1 Wenna's placement.** The seed puts Wenna `present` at beat 0 with `zone: "loft"` (hidden).
  NPCs without a combatant get no snapshot zone, so narration placed her on the bank, and she
  counts as met from scene start. A candidate rule: a present NPC in a fogged zone is unmet and
  unplaced until the zone is revealed. Not settled here; card it.
- **OQ-2 Public cast.** The public `scene.changed` payload's `cast` lists every seed NPC, including
  Snag ("goblin leader") and Pell ("keeper's grandson, captive"). Clients receive unmet names
  (constitution III). Card it.
- **OQ-3 Chronicle.** The seq 24 journal entry repeated "Pell and Snag". The chronicle reads the
  transcript, so this fix removes the source, but no check runs on chronicle output. Card or accept.
- **OQ-4 Human posts.** A human player's public post may name an unmet actor; it reaches companion
  transcripts unfiltered. This spec does not filter player words.
- **OQ-5 Zone knowledge.** Speech may never name a fogged zone, even one the speaker stands in
  (Wenna and the loft). A speaker zone-knowledge rule is deferred.
