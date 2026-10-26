# Research: DM runtime (TASK-0046)

Each entry: decision, rationale, alternatives rejected. Settled inputs (node order, purposes,
no LangGraph, gate-only writes, engine owns numbers) come from decision-0017 to
decision-0021 and are not reopened here.

## R1. One jobs table, new kinds, a generic fenced-write module

**Decision.** Add `turn`, `companion` and `chronicle` kinds to the existing `jobs` table
(migration `0004`). Move the fenced writes (`heartbeat`, `setStage`, `finishJob`, plus a new
`saveResult`) into `apps/server/src/jobs/queue.ts`, parameterized by job; ingestion keeps its
exported names. Each consumer keeps its own claim SQL.

**Rationale.** The card and decision-0017 name "the existing Postgres jobs queue". The claim,
lease and fencing are proven by ingestion's suites and its restart bench (decision-0005).
Claim SQL differs by consumer (ingestion is FIFO; DM jobs need priority and per-session
serialization), so a shared claim would grow flags.

**Alternatives.** A second `dm_jobs` table: duplicates the queue machinery the card says to
reuse. One generic claim with options: hides two different scheduling rules behind one
function.

**Found during research.** `claimJob` today has no `kind` filter, and `listJobs`/`getJob`
assume ingest input. Without the filter the ingest worker would claim a turn job and the
library job list would fail to parse it. Both get `kind = 'ingest'` (FR-007).

## R2. Enqueue from `gate.onAppended`, repaired by reconcile

**Decision.** A gate listener enqueues a turn job when an append holds `action.committed`
(or an approval/rejection of an `ai:dm` proposal). Worker start runs `reconcileTurnJobs`.

**Rationale.** Every commit, human or companion, passes the gate, so one listener sees them
all. The listener runs after the append commits; a crash in between loses only the enqueue,
which reconcile restores from the log.

**Alternatives.** Insert the job in the gate's append transaction: couples the gate to the
jobs table and widens the write boundary the AC #1 test of spec 029 keeps narrow. Poll the
log for commits: adds latency and a scan on every poll.

## R3. Per-session serialization with partial unique indexes

**Decision.** `jobs_turn_queued_key` (one queued turn per session) and
`jobs_session_running_key` (one running turn or companion job per session), plus the
claim's `NOT EXISTS`.

**Rationale.** The single queued row is the next beat: any number of commits during a turn
collapse into it (A12). The running index is the backstop for the one race the `NOT EXISTS`
cannot see (a reclaim and a queued claim in the same instant); the loser gets a unique
violation and polls again.

**Alternatives.** Advisory locks per session: invisible in the table and lost on a crashed
connection. A per-session queue table: more schema for the same rule.

## R4. The beat is frozen at assemble

**Decision.** The beat is the committed, unresolved actions visible at assemble, plus
resolved actions no narration names; it is stored in the checkpoint.

**Rationale.** A12: "nothing is cancelled; actions committed while a turn resolves queue into
the next beat." Freezing gives a stable unit for interpret and audit. Including
resolved-but-unnarrated actions makes a crash between resolve and narration recoverable.

**Alternatives.** Re-read the beat at resolve: a late commit would skip interpret.

## R5. Reclaim resumes from a checkpoint; markers cover the crash window

**Decision.** The turn job saves a checkpoint after director, interpret, adjudicate and each
gate submission. Every command reason ends with ` [<jobId>#<n>]`. On reclaim, recorded
submissions are replayed and the one in-flight submission is detected by its marker.

**Rationale.** The gate has no idempotency key, and adding one is a gate contract change.
Re-running LLM nodes after a crash would re-plan with different output and could double a
step. Memoized node outputs make the resumed turn deterministic; the marker covers the gap
between an append and the checkpoint write. Engine reasons already reach the ledger, so the
marker is visible without a schema change.

**Alternatives.** Idempotency keys in the gate (contract change to 029, more scope). Accept
at-least-once (double damage on a crash: a visible correctness bug in the ledger).

## R6. Branching on engine events only

**Decision.** Interpret and adjudicate emit `Step`s with success/failure/hit effects as data;
resolve picks the branch from the `check.resolved` or `attack.resolved` event.

**Rationale.** The engine contract (R8 of spec 026): the engine owns every comparison. A
model never sees a die before resolve, and never chooses a branch after it.

**Alternatives.** Re-ask the model after each roll for the next step: more calls, and it
lets the model react to dice in planning, which ordering exists to prevent.

## R7. Dice lines rendered by code; prose has no digits

**Decision.** Narrate writes prose without digits. Code renders the dice and damage lines
from the facts and appends them.

**Rationale.** It removes the most common ledger mismatch (a wrong number) by construction
and matches the doctrine's "dice results on their own line". Audit's digit check then becomes
a hard, cheap rule.

**Alternatives.** Let the model write numbers and check them: works, but fails more and
costs regenerations.

## R8. Audit: deterministic checks first, then a cheap model; three attempts; fallback

**Decision.** See [contracts/audit.md](contracts/audit.md). Three attempts, then the
code-built factual summary plus a `dm`-visibility journal flag. An unavailable audit model
also ships the summary.

**Rationale.** AC #7 and decision-0017: never ship silently. A bounded loop keeps cost
predictable. A summary built from facts cannot disagree with the ledger.

**Alternatives.** Fail the turn on audit failure: stalls play. Ship the last attempt with a
flag: ships a known mismatch, which AC #7 forbids.

## R9. Rulings and audit flags as `dm` journal entries

**Decision.** A ruling and a fallback flag are `journal` proposals with visibility `dm`.

**Rationale.** No catalog or proposal-kind change; `journal` is `auto` by default even with a
human seat, so a human DM sees them without approval noise. The structured records stay in
the turn job's result for the harness. Open Questions 2 and 4 offer the alternatives.

**Alternatives.** A new `audit.flagged` type and a `ruling` kind: cleaner reads, but a
contract change to 028/029 for M2.

## R10. Companions and chronicle as their own job kinds

**Decision.** `companion` and `chronicle` jobs, not pipeline nodes.

**Rationale.** A companion is an actor (A11, decision-0014); acting inside the DM's turn
would make it the DM's puppet and would add a node to AC #2's fixed order. Chronicle is off
the hot path by definition. Separate kinds reuse the same claim and fencing.

**Alternatives.** A companion node between director and interpret: changes the pipeline and
blurs who acts. Chronicle inline after audit: puts it on the hot path.

## R11. The hold

**Decision.** In free mode the Director may hold a beat once for named AI companions; the
companion job ends by forcing the next turn job to resolve.

**Rationale.** decision-0018 gives the Director beat timing; a hold lets companions join the
human's beat. The force flag bounds it to one hold, so a model cannot loop the scene.

**Alternatives.** No hold (companions always act after the beat): loses "the Director decides
when a beat resolves" in free mode. Unbounded holds: a loop risk.

## R12. Purpose-keyed fake scripts

**Decision.** `FakeProvider.scriptChatFor(purpose, …)` plus a JSON `DmScript` with dice.

**Rationale.** Chronicle and companion jobs interleave with turns; a single FIFO would hand
one purpose's response to another. Purpose queues make a script order-independent across
purposes and reusable by TASK-0048. Strict mode turns an unscripted call into a failure.

**Alternatives.** A second fake adapter kind: duplicates the existing one for one feature.

## R13. JSON outputs with one repair re-ask

**Decision.** Nodes that return data ask for JSON only, parse it with Zod, and re-ask once
with the issues.

**Rationale.** Provider-agnostic (decision-0007): no vendor tool-calling or JSON mode is
assumed. One re-ask fixes most format slips; a second failure is a node failure.

**Alternatives.** Vendor structured-output modes: not available through every
OpenAI-compatible endpoint and would privilege a vendor.

## R14. The seed as a JSON file under `apps/server/seeds/`

**Decision.** `apps/server/seeds/<seedId>.json`, loaded with `fs` relative to the module;
the Dockerfile copies the directory.

**Rationale.** AC #13 says "file". JSON stays data, reviewable, and replaceable by codex
fixtures in TASK-0060. `tsc` does not copy JSON, so the image needs one `COPY` line.

**Alternatives.** A TypeScript module exporting the seed: not a file the operator can swap;
mixes data into code.

## R15. Doctrine source check

**Decision.** Adapt the right/wrong pairs from tabletop-dm `skills/tabletop-dm/SKILL.md` and
`skills/tabletop-dm/reference/dm-style.md` at `fe2c29b`; license MIT, `Copyright (c) 2026
Brad Bush` (read from the repository's `LICENSE` at that commit on 2026-10-26).

**Rationale.** decision-0021 idea 5 names the source and the attribution duty. The pairs are
reworded for a node pipeline; the notice ships regardless.

## R16. No new dependency; workspace link to `@the-stacks/srd`

**Decision.** `apps/server` adds `@the-stacks/srd` as a `workspace:*` dependency. No
third-party package is added.

**Rationale.** Compact records and SRD monsters are needed by assemble and the seed loader.
The workspace package already ships in the image (`packages/srd/dist`, `data`).
