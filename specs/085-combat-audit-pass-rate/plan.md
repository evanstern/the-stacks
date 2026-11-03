# Implementation Plan: Combat audit pass rate

**Branch**: `task-0214-combat-audit-pass-rate` | **Date**: 2026-11-03 | **Spec**: [spec.md](spec.md)

**Input**: `specs/085-combat-audit-pass-rate/spec.md`; runbook A playtest run 1 (PR #109);
runbook B lane B1, merge spine #19 (`docs/design/m3-runbook-b-resolution-quality.md`). This plan
assumes OQ-1 to OQ-4 (a). Research and design are small, so they live in this file; there is no
separate research.md, data-model.md or quickstart.md.

## Summary

Name who is off turn in the narration facts. State one turn rule for narrate and audit. Block an
off-turn actor taking a turn action in code, before the `dm.audit` call. Let the audit name the
character an issue is about, so an NPC's feelings never block. Drop a trailing "What do you do?"
in code. Withhold a goal note that states a count, and tell the Director not to write one. Replay
run 1 seq 103, 126, 131, 161 and 196 against all of it.

## Technical Context

**Language/Version**: TypeScript (Node 22), as the repo.
**Primary Dependencies**: Zod, Vitest. **No new runtime dependency.**
**Storage**: none. **No migration.** No event shape change.
**Testing**: Vitest unit tests and the scripted fake gateway. No DB, no paid model.
**Target Platform**: the server DM pipeline: facts, narrate and audit nodes, narrate, audit and
director prompts, the claim checker and its lexicon.
**Constraints**: no frozen contract changes (`ws-protocol`, spec 029, spec 030 seam). Every new
field is optional, so old scripts, checkpoints and test literals still parse and compile.
`fallback.ts`, interpret, adjudicate and resolve are not edited.
**Scale/Scope**: 8 source files, 1 new test file, 7 extended test files, 4 contract amendments.

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable**: the DM pipeline is the agent path. Every new rule is code or prompt
      text the agent reads. No human-only path.
- [x] **II. Content contract**: no codex entity. N/A.
- [x] **III. Data planes**: no new state. `offTurn` is derived per turn from projections and S1.
- [x] **IV. Event sourcing**: no event changes. The audit record gains an optional `actor` per
      issue inside the existing `jobs.result` JSON.
- [x] **V. Citations**: no library claim. N/A.
- [x] **VI. 5e engine boundary**: no mechanic change. The turn rule restates the engine's turn
      order for the narrator; the engine still owns it.
- [x] **VII. Structured first**: `offTurn` is a typed fact; the checks are pure functions.
- [x] **VIII. Operator-owned content**: no content change. The seed is read, not edited.
- [x] **IX. Self-hostable**: no new service or dependency.

**Stack conformance**: no departure. **Complexity Tracking**: none.

## Research

- **R1 — Why the Turn/Next rule does not hold.** Narrate RULES (narrate-v16) line 36 says "Every
  other character is part of the world. Give them words, moves and reactions." Line 42 then says
  only the Turn actor acts. The narrator gets two rules that disagree and no list of who the
  "other" characters are. Audit rule 6 names only the Next actor, so the `dm.audit` call refuses
  "Odo fires an arrow" on Snag's turn on some attempts and not others. No code check exists.
- **R2 — Code can see the whole roster.** `buildNarrationFacts` has `p.encounter.order` (names,
  life states, initiative order) and `input.resolve.snapshot` (S1 presence). It already knows the
  Turn actor, each Action's character, and each roll's `name`.
- **R3 — The claim gate already parses subjects.** `claims.ts` has the alias index, unique-alias
  rule, quote masking, clause split, `isSubject`, the four-token verb window and the negation rule
  (`actIssues`). A turn-action check is the same walk with a different actor filter and verb list.
- **R4 — NPC feelings.** `llmIssueBlocksFor` blocks a `player-agency` issue when its free-text
  detail names any party member (E2). "Snag sneers at Kestrel's pain" names Kestrel and blocks. The
  model knows whom the issue is about; the schema has no field for it.
- **R5 — The stock ending.** TASK-0204 made the ending a blocking check. Narrate RULES still say
  only "End on something that demands a response", so each stock ending costs a regenerate (one
  narrate and one audit call). Dropping the trailing sentence is safe: the sentence before it is
  the beat's last image.
- **R6 — The goal note.** `withholdRefusedInputs` blanks a note only when `checkClaims` refutes it.
  "Two goblins down" with two goblins dead is true, so it reaches the narrator as "Private note:".
  The phrase restates DM-only seed text (`encounters[].morale`). The Director prompt asks only that
  the note name no party member's undeclared act.
- **R7 — Measuring AC #1.** `AuditRecord.flagged` is true for `passed-after-regenerate` and
  `fallback`, false for `passed`. The playtest auditor already emits one `dm-audit-flag` note per
  flagged job with its issue kinds. So attempt-1 passes = combat narrations − flagged combat
  narrations, with no new code.

## Design

### D1 — `turn.offTurn` (`apps/server/src/dm/facts.ts`)

- `NarrationFacts.turn` becomes `{ actor: string; next: string | null; offTurn?: string[] }`.
- In `buildNarrationFacts`, in the existing `if (npcTurn || input.turnActorId)` block (after
  `turn = {…}`), compute:
  - `onTurn`: `turn.actor`, each `actions[].characterName`, each `name` of `actions[].rolls` and
    `npcTurn.rolls`. Not `pulled` or `settled` rolls.
  - `offTurn`: `p.encounter?.order` names, in order, where `lifeState === "conscious"`, the S1
    actor with that `combatantId` (`input.resolve.snapshot.actors`) is not `absent`, and the name
    is not in `onTurn`. Set `turn.offTurn` only when non-empty.

### D2 — The turn rule and the Off turn line (`apps/server/src/dm/prompts/narrate.ts`)

- Export `TURN_RULE` (one string): "Only the actors on the Turn line, the Action lines and the roll
  lines act in this beat. The actor on the Next line has not acted: never show them move, speak or
  strike. A character on the Off turn line may speak, look, flinch or brace, but never strikes,
  shoots, casts, throws or charges in this beat."
- RULES: replace line 36 ("Every other character is part of the world. Give them words, moves
  and reactions.") with "Every other character is part of the world. Give NPCs and monsters
  words, looks and feelings." Replace line 42 (the Turn/Next sentence) with `TURN_RULE`. Replace
  line 47 with "End on something that demands a response. Never end on \"What do you do?\" or an
  either-or question, except the Unclear intent question."
- `factEntries`: after the `Next:` push, when `facts.turn.offTurn?.length`, push
  `Off turn: <names joined by ", "> (may speak, look or flinch; no strike, shot, cast, throw or charge).`
- `PROMPT_VERSION` → the next narrate version.

### D3 — Audit prompt (`apps/server/src/dm/prompts/audit.ts`)

- Import `TURN_RULE` beside `factEntries`.
- Rule 1: append "An NPC's or monster's words, looks and feelings are the world's, never
  `player-agency`. Set `actor` to the character each issue is about."
- Rule 6: replace with "6. Turn mode. " + `TURN_RULE` + " Showing the Next actor or an Off turn
  character strike, shoot, cast, throw or charge is `invented-mechanics`. Their words, looks and
  flinches are not."
- `OUTPUT_SHAPE` line 2: add `"actor":str (optional; the character the issue is about)` inside
  the issue object.
- `PROMPT_VERSION` → the next audit version.

### D4 — Lexicon (`apps/server/src/dm/audit-words.ts`)

- `TURN_ACT_VERBS: readonly string[]` = `attack`, `swing`, `strike`, `slash`, `stab`, `lunge`,
  `charge`, `fire`, `shoot`, `loose`, `throw`, `hurl`, `cast`. `verbForms` and the existing
  irregulars cover every form; add no irregular entry.
- `STOCK_ENDING = /\bwhat do you(?: all| two)? do\?["'”’]*$/i`, moved from the inline
  regex in `nodes/audit.ts` (TASK-0204) so both nodes share it.
- `hasCountClaim(text: string): boolean`: true when any of `COUNT_PATTERNS.numberDown`,
  `noneLeft` or `allDown` matches (fresh `RegExp(src, "iu")` each).

### D5 — Off-turn check (`apps/server/src/dm/claims.ts`)

- Export `offTurnActs(state: ClaimState, text: string, offTurn: readonly string[]): ClaimIssue[]`.
- Build a `Context`. Mask quotes. For each clause and each unique occurrence whose actor's `name`
  is in `offTurn`: skip a barred actor (the claim gate reports it), skip the turn-order phrase,
  require `isSubject`, then walk the same four-token window as `actIssues` up to the first comma.
  Stop at another actor's alias or a negation. Match a token whose lemma is in `TURN_ACT_VERBS`
  (a local `Set` of `verbForms` output). Emit `claim: "act"`, detail
  `<display name> is off turn and is shown taking a turn action ("<matched>").`
- `// ponytail: unique aliases only ("the goblin" with three goblins is skipped); upgrade to the
  group-noun resolver when a playtest shows a shared-noun breach passing.`

### D6 — Audit node (`apps/server/src/dm/nodes/audit.ts`)

- `AuditIssue` gains `actor?: string`. `AuditModelOutput` issue object gains
  `actor: z.string().min(1).max(80).optional()`.
- `llmIssueBlocksFor`: for `player-agency`, when `issue.actor` is set, return
  `detailNamesPartyMember(issue.actor, party)`; else today's detail test.
- `deterministicChecks`: after the `checkClaims` loop, when `facts.turn?.offTurn?.length`, add
  each `offTurnActs(state, prose, facts.turn.offTurn)` issue as `invented-mechanics` with its
  detail.
- Replace the inline stock-ending regex with `STOCK_ENDING`.

### D7 — Narrate node (`apps/server/src/dm/nodes/narrate.ts`)

- `narrateAttempt`: after `clipProse`, call `dropStockEnding(prose)`. Export it: when
  `STOCK_ENDING` matches and a sentence end precedes the match, return the text up to and
  including that sentence end, trimmed; else return the prose unchanged.
- `withholdRefusedInputs`: blank the goal note when `refuse(...)` or `hasCountClaim(goalNote)`.
  For a count, push `{ kind: "doctrine", detail: "Withheld goalNote: it states a count (\"<first
  60 chars>\")." }` to `withheld`.

### D8 — Director prompt (`apps/server/src/dm/prompts/director.ts`)

- `goalNote` shape text: append "; it states no count of the fallen or the remaining, no morale
  condition and no encounter trigger".
- `PROMPT_VERSION` → the next director version.

## Replay (card AC #2)

`apps/server/test/dm/combat-audit-replay.test.ts`. Header: source is runbook A playtest run 1
(PR #109) findings 10–28, session `9296c653`, seed `greyhollow-ford-reed-camp`; the rows live on
vm-104, so each beat is rebuilt from the log (OQ-1 (a)); prose marked "rebuilt" is not run 1
text. Build facts with `buildNarrationFacts` over a fixture in the style of
`npc-turn-narration.test.ts` and `talk-fallback-line.test.ts` (seed names: Tamsin Vale, Brother
Odo, Kestrel, Snag, Pell Marsh, Goblin with a pot-helm, Goblin lookout, Goblin by the fire). Each
`describe` asserts the next-version narrate prompt holds `TURN_RULE` and the `Off turn:` line, and
that the beat's fallback passes `deterministicChecks`.

| Seq | Beat | Cases |
|---|---|---|
| 103 | Snag's turn; pulls Pell in (initiative roll in `pulled`); Next: Goblin lookout | Rebuilt "Brother Odo looses an arrow at Snag" (finding 11: "Odo firing an arrow") blocks in code (`invented-mechanics`, no `dm.audit` call made). Rebuilt "the lookout dies" with no dead actor still blocks via `checkClaims`. The fallback holds Pell's initiative dice line (TASK-0213 regression) |
| 126 | Pell's talk turn with a `say` line; Next: Goblin with a pot-helm | Rebuilt "The goblin with a pot-helm lunges at Kestrel" blocks. Scripted `dm.audit` pass with a `player-agency` issue `actor: "Snag"` whose detail names Kestrel ships attempt 1. Prose voicing Pell's line passes |
| 131 | Pot-helm goblin, step `none`; Next: Goblin by the fire; goal note "Two goblins down; Snag eyes a bargain." | Logged fallback text "rises from the rushes at Kestrel's flank, scimitar ready" passes the turn check. Rebuilt "The goblin by the fire hurls a spear" blocks. The goal note is withheld and absent from the prompt. Prose ending "… What do you do?" reaches the audit without that sentence |
| 161 | Kestrel's move; the goblin's reaction hit; followUp "free Pell"; Next: Snag | Rebuilt "The goblin with a pot-helm strikes as Kestrel pulls away" passes (roller on turn). Rebuilt "Snag drives his spear at Kestrel" blocks. Rebuilt "Kestrel's blade parts the rope" passes code (OQ-2) and blocks on a scripted `dm.audit` `invented-mechanics` issue; the audit prompt holds `not yet attempted:` |
| 196 | Pot-helm goblin drops Kestrel to zero; Next: the order's next actor | Rebuilt "Brother Odo cries out and lunges at the goblin" blocks (lunge; the cry alone passes). A `player-agency` issue `actor: "Odo"` blocks (OQ-3 (a)). One `actor: "Snag"` is advisory. The fallback says "falls unconscious" once (TASK-0212 regression) |

## Measuring AC #1 (at the playtest, not at merge)

Add this as the runbook B scenario's narration row procedure (the orchestrator writes
`docs/playtests/scenarios/runbook-b-*.md`; this task does not):

1. Play 15 or more combat turns (narrations while the table is in turn mode).
2. Run `pnpm playtest audit` on the session. Count combat narration segments (N).
3. Count `dm-audit-flag` notes whose segment is a combat narration (F). Each note lists
   `final`, `attempts` and issue kinds.
4. Report `N − F` of `N` and the share. Pass at 70% or more. List each flag's issue kinds.

## Contracts

- `specs/034-narration-quality/contracts/narration-facts.md`: amendment — `turn.offTurn` and the
  `Off turn:` line.
- `specs/034-narration-quality/contracts/audit-criteria.md`: amendment — the off-turn check, the
  optional issue `actor` and its blocking rule, the shared `STOCK_ENDING`, the dropped stock
  ending, the count-withheld goal note.
- `specs/051-output-claim-gate/contracts/claim-gate.md`: amendment — `offTurnActs`.
- `specs/031-dm-runtime/contracts/director.md`: amendment — the `goalNote` restriction.

## Files

| File | Change | Phase |
|---|---|---|
| `apps/server/src/dm/facts.ts` | D1 | 1 |
| `apps/server/src/dm/audit-words.ts` | D4 (`TURN_ACT_VERBS`, `STOCK_ENDING`, `hasCountClaim`) | 1, 2 |
| `apps/server/src/dm/claims.ts` | D5 | 1 |
| `apps/server/src/dm/nodes/audit.ts` | D6 (check call in 1; `actor`, `STOCK_ENDING` in 2) | 1, 2 |
| `apps/server/src/dm/prompts/narrate.ts` | D2, narrate version bump | 1 |
| `apps/server/src/dm/prompts/audit.ts` | D3 (rule 6 in 1; rule 1 and shape in 2), audit version bump in 1 | 1, 2 |
| `apps/server/src/dm/nodes/narrate.ts` | D7 | 2 |
| `apps/server/src/dm/prompts/director.ts` | D8, director version bump | 2 |
| `apps/server/test/dm/facts.test.ts` | `offTurn` cases | 1 |
| `apps/server/test/dm/claims.test.ts` | `offTurnActs` cases | 1 |
| `apps/server/test/dm/audit.test.ts` | check wiring; `actor` blocking | 1, 2 |
| `apps/server/test/dm/narrate.test.ts` | version pins, Off turn line, `dropStockEnding`, count-withheld note | 1, 2 |
| `apps/server/test/dm/npc-turn-narration.test.ts` | update the pinned Turn rule and audit rule 6 strings (lines 205, 215) | 1 |
| `apps/server/test/dm/assemble.test.ts` | director version pin and `goalNote` text | 2 |
| `apps/server/test/dm/combat-audit-replay.test.ts` | new; the replay | 3 |
| the four contract files above | amendments | 3 |
| `docs/wiki/dm-narration-quality.md`, `dm-runtime.md`, `output-claim-gate.md`, `presence.md`, `CAPSULES.md`, `INDEX.md` | re-ground | 4 |

**Footprint note for the orchestrator**: the runbook's expected footprint for 0214 was
`prompts/narrate.ts`, `facts.ts`, `prompts/audit.ts`, `fallback.ts`. This plan drops `fallback.ts`
and adds `claims.ts`, `audit-words.ts`, `nodes/audit.ts`, `nodes/narrate.ts` and
`prompts/director.ts`. 0214 is last on the spine, so nothing develops beside it.

## Overlap

Before Phase 1, merge `origin/main` and re-read the current narrate, audit and director
`PROMPT_VERSION`. "Next version" is one past what main holds then (narrate-v16, audit-v10 and
director-v6 at authoring).
