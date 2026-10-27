# Data model: Output claim gate (spec 051)

All types are in-process TypeScript in `apps/server/src/dm/claims.ts`. Nothing is persisted
except through the existing `AuditRecord` (`jobs.result.audit`), whose shape does not change.

## ClaimState (input)

| Field | Type | Notes |
|---|---|---|
| `snapshot` | `ActorSnapshot` | S1 for narration; S1 for ruling and `goalNote` too |
| `diff` | `SnapshotDiff \| null` | S0-to-S1; `null` when there is no prior state (then FR-004a and FR-006 do nothing) |

## ClaimResult (output)

| Field | Type | Notes |
|---|---|---|
| `pass` | `boolean` | `issues.length === 0` |
| `issues` | `ClaimIssue[]` | in text order |

## ClaimIssue

| Field | Type | Notes |
|---|---|---|
| `claim` | `"act" \| "speech" \| "death" \| "down" \| "omission" \| "count"` | |
| `actorIds` | `string[]` | the referenced actors; empty for an unattributed claim |
| `matched` | `string` | the matched text, at most 60 characters |
| `detail` | `string` | one sentence naming the actor, its state and the matched text, e.g. `Tamsin Vale is unconscious and is shown acting ("Tamsin's hand twitches toward her sword, her fingers curling").` |

The audit node maps each to `{ kind: "ledger-mismatch", detail: "Actor state: " + detail }`.

## Reference (internal)

| Field | Type | Notes |
|---|---|---|
| `term` | `string` | an alias term or a group noun |
| `actorIds` | `string[]` | one id for a unique term; two or more for a group term or noun |
| `unique` | `boolean` | `actorIds.length === 1` and the term is an alias |

## Lexicons (in `audit-words.ts`)

| Name | Content (lowercase; each verb in base, -s, -ed and -ing forms unless noted) |
|---|---|
| `ACT_VERBS` | attack, swing, strike, slash, lunge, grip, grab, seize, draw, raise, lift, reach, curl (with "around"), stand, rise, get up, climb, run, charge, step, walk, wade, move, turn, look, watch, nod, smile, grin, aim, nock, fire, shoot, throw, cast, point, wave, pull, push, shove, flee, bolt |
| `SPEECH_VERBS` | say, speak, shout, shriek, call, cry, whisper, mutter, snarl, growl, answer, reply, ask, beg, plead, yell, laugh, sob |
| `INVOLUNTARY_VERBS` | lie, breathe, bleed, slump, sprawl, twitch, shiver, stay, remain, rest; disjoint from `ACT_VERBS` and `SPEECH_VERBS` |
| `NEGATIONS` | cannot, can't, can not, could not, couldn't, does not, doesn't, did not, didn't, no longer, fails to, failed to, too weak to, unable to, never |
| `DEATH_ATTRIBUTION` | dies, died, is dead, lies dead, killed, slain, dead (adjective) |
| `DOWN_ATTRIBUTION` | unconscious, knocked out, passes out, blacks out, collapses, crumples, goes down |
| `NUMBER_WORDS` | one … twelve → 1 … 12; both → 2 |
| `TURN_ORDER_PHRASE` | `<term> (acts|moves) next` |
| `COUNT_PATTERNS` | (1) `<number> [≤3 words] (down|dead|fallen|dropped)`; (2) `(no|none|not one) [of the] <noun> (left|remain|remains|remaining)`; (3) `(last|only|lone) <noun>`; (4) `all [the] <noun> (are )?(down|dead)` |

## Changed existing types

| Type | Change |
|---|---|
| `deterministicChecks(facts, narration)` | gains a required third argument `state: ClaimState` |
| `factualSummary(facts)` | gains an optional second argument `state?: ClaimState` |
| `NarrateOutput` | gains `withheld: AuditIssue[]` |
| `AuditRecord`, `AuditAttempt`, `RecordedIssue`, `AuditModelOutput` | unchanged; withheld issues sit in attempt 1 `deterministic.issues` with `blocking: false` |
