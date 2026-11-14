---
name: output-claim-gate
description: RETIRED by TASK-0272 (spec 103). The output claim gate (TASK-0143, specs/051), `checkClaims` in `claims.ts`, no longer exists. Its job passes to the pure narration check in `narration-check.ts` (leak and contradiction checks, corrections, no regenerate loop). Read only to learn what was removed and where each duty went.
kind: component
sources:
  - apps/server/src/dm/narration-check.ts
  - apps/server/src/dm/narration-words.ts
  - apps/server/src/dm/gates/plan-gate.ts
  - specs/051-output-claim-gate/contracts/claim-gate.md
verified_against: 87c50b511c3ba79cf4f4ad489de6ecfaadc918f9
---

# Output claim gate (retired)

**Retired by TASK-0272 (spec 103, `specs/103-prose-slots/`).** `dm/claims.ts` (`checkClaims`, `ClaimResult`) and `dm/audit-words.ts` are deleted. The current behaviour is in [[dm-narration-quality]] (section "Check node"). Spec 051 and its contract remain as history.

## Where each duty went

- **Absent actor shown** and **dead or downed actor acting**: the check node's leak check (`absent-actor`, `unmet-success`) and `life-state` contradiction in `checkNarration` (`narration-check.ts`). The check is lexical and by proximity, not the old clause grammar.
- **Wrong deaths and drops, omitted deaths, wrong counts, off-turn acts**: no longer checked. The code-written fact rows and State line carry the facts (constitution VII). `hasCountClaim` (`narration-words.ts`) still blocks a `goalNote` that states a count.
- **Refused rulings and `goalNote` text**: `withholdRefusedInputs` (`nodes/narrate.ts`) now calls `checkNarration` for `life-state` and `dm-only-text` hits.
- **Plan gate reason check** (spec 058, `REASON_CONTRADICTS_STATE`): deleted from `checkPlan` in `dm/gates/plan-gate.ts` (spec 103 OQ-1). Spec 110 later deleted the gate's other step checks; it keeps only the held off-turn companion ([[dm-plan-gate]], [[dm-failure-and-gates]]).
- **Fallback and audit**: `factualSummary`, `deterministicChecks` and the `dm.audit` call are deleted. A leak drops the sentence and files a `dm` correction; a contradiction ships with a public correction.

The alias matcher the claim gate introduced lives on in `snapshot/aliases.ts` ([[actor-snapshot]]).
