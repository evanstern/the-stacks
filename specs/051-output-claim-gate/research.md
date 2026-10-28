# Research: Output claim gate (spec 051)

No NEEDS CLARIFICATION remained after the operator rulings. Each entry records a design choice
made while grounding against the code at the branch base (`b7be35d`).

## R1. Where the checker runs

- **Decision**: inside `deterministicChecks`, so claim issues ride the existing blocking path.
- **Rationale**: the loop in `nodes/audit.ts` already skips `dm.audit` when a deterministic
  issue exists, feeds blocking issue details to `narrateAttempt`, and ships `factualSummary`
  after `MAX_NARRATION_ATTEMPTS`. AC #5 is met with no new loop.
- **Alternatives**: a separate node between narrate and audit. It duplicates the loop and changes
  the node list in `specs/031-dm-runtime/contracts/nodes.md`.

## R2. Unique terms versus group terms

- **Decision**: only an alias held by one actor can trigger an act or wrong-actor refusal.
- **Rationale**: in M2 the narrator names monsters by description ("the pot-helmed goblin",
  "the goblin hauling Pell"). Those descriptions match no alias, and "goblin" is shared by four
  actors (goblin-2, goblin-3, goblin-4 and Snag via "the goblin leader"). A refusal on a shared
  word would refuse M2 seq 220, which is correct prose. OQ-5 (a), ruled.

## R3. Which down words attribute a drop

- **Decision**: attribution uses a narrow list (`DOWN_ATTRIBUTION`). The omission check keeps
  today's broad `UNCONSCIOUS_RECORDED`.
- **Rationale**: "drops" and "falls" have non-life meanings. M2 seq 299 has "Snag … the clapper
  drops into the mud". A broad attribution list would call Snag downed. For omission, a broad list
  only makes the check easier to pass, which keeps today's floor.

## R4. The transition exemption (FR-004a)

- **Decision**: an actor whose life state or presence changed this turn is exempt from the act
  rule. The turn-order phrase "<name> acts next" or "<name> moves next" is exempt too.
- **Rationale**: the fallback narrates presence changes ("Snag flees.", `facts.test.ts:548`) and
  turn advances ("Kestrel moves next.", run 192319Z seq 161). Turn advance skips only `dead`
  combatants, so an unconscious PC can be next. Without the exemptions the fallback fails the
  checker, and FR-011 requires it to pass. Narration of a death or flight this turn ("lunges,
  then drops") is the transition itself. The exemption stays within OQ-5 (a): no refusal the
  ruling expects is lost. The four card evidence cases involve no transition this turn.

## R5. Count sides for a bare "N down"

- **Decision**: compare N with the non-party count and with the party count; pass on either.
- **Rationale**: the speaker's side is unknowable without disposition, which is untracked in M3
  (decision-0025 Consequences). At M2 seq 225, non-party = 1 and party = 0, so "Two down" fails
  both. OQ-5 (a), ruled.

## R6. Withholding a ruling or `goalNote`

- **Decision**: filter `facts` once in the narrate node, and record a non-blocking issue on
  attempt 1.
- **Rationale**: OQ-2 (a), ruled. `goalNote` is `z.string().max(300)` with no minimum
  (`nodes/schemas.ts:255`), so an empty note is a valid value. The prompt shape "Private note: "
  is unchanged. `facts.rulings` is a list, so dropping an entry needs no builder change.

## R7. The row 162 prose is not recoverable

- **Decision**: rebuild fixture sentences from the audit's quoted fragments.
- **Rationale**: `AuditAttempt` stores `proseSha256`, not prose (`nodes/audit.ts`). The fragments
  are in the row 162 journal body and in `jobs.json` job `ab5ba4ae…`, attempts 2 and 3. The
  substitute is recorded in spec.md "Evidence".

## R8. Folding the recorded logs

- **Decision**: reuse the `loadLog` and `foldThrough` pattern from
  `test/dm/seed-npc-presence.test.ts` (`StoredEventSchema.parse`, `applyEvent`,
  `emptyProjections({ role: "dm" })`), moved into `test/dm/claim-fixtures.ts`.
- **Rationale**: one fold implementation for both recorded logs. The M2 log already parses under
  that test. Run 192319Z has the same event shapes (`payloadVersion: 1`). The Phase 1 dispatch
  confirms it by running the fold.

## R9. Prompt registry

- **Finding**: there is no central prompt registry. Each prompt module exports
  `PROMPT_VERSION`; the only assertion on `dm.narrate-v4` is `test/dm/narrate.test.ts:310`.
  Fake-gateway scripts match by `purpose`. Recorded fixtures keep their recorded versions.
  The plan lists the full consumer table (D6).
