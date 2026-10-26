# Contract: audit criteria v2 — what blocks, what advises

Amends `specs/031-dm-runtime/contracts/audit.md` ("The loop", "Deterministic checks", "The
audit call", "The audit record"). Evidence: research.md R1, R7.2 (E2). Card AC #3.

## Blocking and advisory issues

| Source | Kind | Blocks? |
|---|---|---|
| Deterministic check | every kind | yes |
| `dm.audit` | `ledger-mismatch` | yes |
| `dm.audit` | `invented-mechanics` | yes |
| `dm.audit` | `player-agency` | yes when its detail names a party member (the party-name filter, below); otherwise no (advisory) |
| `dm.audit` | `doctrine` | no (advisory) |
| `dm.audit` | `other` | no (advisory) |

Code derives the attempt's result from the issues and `facts.party`. An attempt passes when the deterministic
checks pass and the `dm.audit` call returns no blocking issue. The model's `verdict` is recorded
and not used. `AuditModelOutput` is unchanged.

## The party-name filter (E2, amendment 2026-10-26)

Evidence: research.md R7.2. The verification run's `dm.audit` blocked on 21 `player-agency`
issues. 8 of them name no party member; they judge world characters (Pell, Snag).

Code decides whether a `dm.audit` `player-agency` issue blocks. The model's kind is kept. Only
its `blocking` flag changes.

**Rule.** A `player-agency` issue blocks when its `detail` holds at least one party-name term.
Otherwise the issue is advisory.

**Party.** The party is every entry of `facts.party`, both controllers. AI companions
(`controller: "ai-companion"`) count as party members. This follows narrate v2 rule 1 and audit
v2 statement 1: "The party members are player characters, AI companions included."

**Party-name terms.** Build these terms for each party member:

1. The full `name` ("Tamsin Vale", "Brother Odo", "Kestrel").
2. The `characterId` ("tamsin", "odo", "kestrel").
3. The given name. Split `name` on whitespace. Drop leading title words. When at least one word
   remains and `name` had more than one word, the first remaining word is the given name
   ("Tamsin Vale" gives "Tamsin"; "Brother Odo" gives "Odo").

Title words are a fixed list, compared case-insensitively: `Brother`, `Sister`, `Father`,
`Mother`, `Sir`, `Dame`, `Lord`, `Lady`, `Master`, `Mistress`.

A surname alone is not a term ("Vale" does not match). A title word alone is not a term
("Brother" does not match). Drop empty and duplicate terms.

**How a term matches.**

- Matching is case-insensitive and Unicode-aware.
- A term matches only as a whole word. The character before the match and the character after
  it must not be a letter, a digit, `_` or `-`. The start and the end of `detail` count as
  boundaries.
- In a multi-word term, each space matches one or more whitespace characters.
- Escape every term before building the pattern. Pattern per term:
  `(?<![\p{L}\p{N}_-])<escaped term>(?![\p{L}\p{N}_-])`, flags `iu`.
- A possessive matches: "Tamsin's" and "Odo’s" hold a term. "Odor" and "Tamsin-like" do not.

**What does not change.**

- Every deterministic check still blocks.
- `ledger-mismatch` and `invented-mechanics` still block. `doctrine` and `other` stay advisory.
- The `dm.audit` prompt text does not change. `PROMPT_VERSION` stays `dm.audit-v2`.
- `AuditModelOutput`, `RecordedIssue` and `AuditAttempt` do not change. An advisory
  `player-agency` issue is recorded with `blocking: false`. The fallback journal body marks it
  `[advisory]`. It never reaches regeneration.

**Known residual (recorded, not fixed here).** An issue that names a party member only in
passing still blocks ("Pell's emotional state ... without Tamsin's declared action"). So does a
closing-question complaint filed as `player-agency` ("Final line 'What does Tamsin do?'").
research.md R7.2 gives the counts and an alternative rule pending an operator ruling.

## The loop (changes only)

```
  llm = det.pass ? auditCall(...) : skipped
  blocking = det.issues + llm.issues where kind blocks
  if blocking is empty: ship narration; stop
  ...
  issuesSoFar += blocking            # advisory issues never reach regeneration
```

`MAX_NARRATION_ATTEMPTS` stays 3. An audit call failure still ships the fallback.

## Deterministic checks (changes only)

| Check | Change |
|---|---|
| clarify question (new) | Fails when `facts.clarify` is non-empty and the trimmed prose does not end with `?`. Kind `doctrine`. Detail: "The facts ask a question and the prose does not end with one." |
| life states | The detail quotes the matched words, at most 60 characters: `The prose says a character dies ("<match>"), and no fact records a death.` |
| option menu | The detail quotes the closing question, at most 120 characters. |
| length | The detail states the count: `The prose is <n> words; the limit is 220.` The limit stays 220. |

## The audit call v2 (`prompts/audit.ts`, `PROMPT_VERSION = "dm.audit-v2"`)

The user prompt adds the facts' `## Party (player characters)` and `## Other characters (the
world)` sections (contracts/narration-facts.md). The system prompt states:

1. "`player-agency`: the prose decides what a PARTY member says, feels or chooses beyond their
   declared action. Showing a party member carry out their declared action is allowed. Words,
   moves and feelings of every other character are the world's, never `player-agency`."
2. "`invented-mechanics` or `ledger-mismatch`: the prose grants a rules result no fact records —
   a hit, a wound, a condition, a death, a success at an uncertain task, or a hidden discovery —
   or contradicts a fact. No rules effect means nothing was rolled; the attempt still happens
   and the world may respond. That is not a mismatch."
3. "When the facts ask a question, ending on that open question is correct."
4. "Code checks length; do not report length."
5. "Report craft concerns as `doctrine`. They are advice and do not fail the narration."

## The audit record (changes only)

```ts
interface RecordedIssue extends AuditIssue { blocking: boolean }
interface AuditAttempt {
  attempt: number;
  words: number;                                   // new: the attempt's prose word count
  deterministic: { pass: boolean; issues: RecordedIssue[] };
  llm: { verdict: "pass" | "fail"; issues: RecordedIssue[] } | { skipped: true } | { error: NodeErrorKind };
  proseSha256: string;
}
```

`final` and `flagged` keep their meaning: `flagged` is true when any attempt had a blocking
issue. The fallback journal body lists each attempt's issues with `[advisory]` before advisory
ones. Stored in `jobs.result` (jsonb). No migration.

## Tests

- `audit.test.ts`: a doctrine-only fail passes on attempt 1 with the issues recorded as
  advisory; a `player-agency` fail regenerates; regeneration receives only blocking issues; the
  clarify check fails a clarify turn's prose without a closing `?` and passes one with an open
  question; each new detail format.
- `audit.integration.test.ts` (scripted gateway): a script whose `dm.audit` returns a
  `doctrine`-only fail ships the narration with `final: "passed"`.
- The audit prompt v2 holds the party section and the five statements.

### Tests for the party-name filter (E2)

Unit tests over the filter, in `audit.test.ts`. Use the seed party: Tamsin Vale (`tamsin`,
human), Brother Odo (`odo`, ai-companion), Kestrel (`kestrel`, ai-companion). Quote the details
verbatim from `evidence/verify-20261026T183818Z-greyhollow-ford-provider/transcript.jsonl`
journal rows titled "Audit flag: narration replaced".

| Case | Detail (source) | Blocks? |
|---|---|---|
| World character only | seq 86 attempt 2: "Narration decides Pell's emotional state and inner determination: ..." | no |
| World character, auditor calls him party | seq 196 attempt 3: "Narration decides Pell's emotional state ('eyes wide') ... Pell is not a party member; ..." | no |
| World character only | seq 278 attempt 1, second issue: "The narration puts words in Snag's mouth ..." | no |
| Given name of a human player | seq 278 attempt 3: "Narration decides Tamsin 'straightens, sword easing down but not sheathed' ..." | yes |
| Given name of a titled companion | seq 153 attempt 2, first issue: "Narration states 'Odo doesn't flinch from the wound beneath his hands' ..." | yes |
| Full titled name | "Narration decides what Brother Odo feels." | yes |
| Companion with a one-word name | "Narration decides Kestrel's reply." | yes |
| Character id, lowercase | "decides tamsin's stance" | yes |
| Surname alone | "The Vale road is quiet; Pell flinches." | no |
| Title word alone | "Pell calls for his brother." | no |
| Term inside a longer word | "An odor of smoke; Pell coughs." | no |

Node tests, in `audit.test.ts` with a scripted `dm.audit` reply:

- A reply whose only issue is a `player-agency` issue naming Pell ships the narration on that
  attempt with `final: "passed"`. The issue is recorded with `blocking: false`.
- A reply whose only issue is a `player-agency` issue naming Tamsin regenerates. The
  regeneration receives that issue.
- A reply with one Pell issue and one Odo issue regenerates. The regeneration receives only the
  Odo issue.
- A deterministic issue still blocks when the reply holds only an advisory `player-agency`
  issue.
