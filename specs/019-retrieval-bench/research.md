# Research: Retrieval benchmark

Each entry records one design call: the decision, why, and what was rejected.

## R1 — Corpus source and size

**Decision.** Take the corpus from the official SRD 5.1 CC-BY-4.0 PDF,
`https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf`. Extract text once at authoring
time with `pdftotext -layout`. Hand-shape it into Markdown (headings `#`–`####`, tables as `|`
rows, lists as `-` items). Commit 8 documents under `apps/server/bench/retrieval/corpus/`:

| File | SRD section |
|---|---|
| `using-ability-scores.md` | Using Ability Scores (checks, saves, skills, advantage) |
| `adventuring.md` | Adventuring (time, movement, environment, resting) |
| `combat.md` | Combat (order, actions, attacks, cover, damage, healing) |
| `spellcasting.md` | Spellcasting rules (slots, components, areas, concentration) |
| `spells.md` | 40 spell descriptions, chosen across levels 0–5 |
| `equipment.md` | Armor, Weapons, Adventuring Gear (including their tables) |
| `conditions.md` | Appendix PH-A: Conditions |
| `monsters.md` | 12 stat blocks plus the "Monsters" rules intro |

Budget: at most 400 KB total, target about 250 KB (roughly 60k tokens). That is big enough that
recall@10 is not trivially 100 %, and small enough to embed per strategy for cents.

**Text rule.** Words stay verbatim. Allowed changes: rejoined hyphenated line breaks, removed
page headers and footers, Markdown structure. `ATTRIBUTION.md` states these changes, as
CC-BY-4.0 §3(a)(1)(B) requires. It also carries the SRD's own attribution statement ("This work
includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the
Coast LLC … licensed under the Creative Commons Attribution 4.0 International License"), the
source URL, the PDF's sha-256, and the extraction command.

**Rejected.** The existing DDB fixtures (a few KB; too small to rank). A third-party SRD JSON
or site mirror (provenance weaker than the publisher's PDF). Any text from
`/Volumes/evan/dnd-sourcebooks` or `fixtures/private/` (constitution VIII; runbook TASK-0029
line). A committed extraction script (one-time authoring step; YAGNI — the command lives in
`ATTRIBUTION.md`).

## R2 — Corpus format and parser

**Decision.** Markdown, parsed by the existing `parseMarkdown` (spec 017). It yields the same
`ParsedBook` the chunker and store take, with headings as `path`. The book name is the file
stem (`combat`). No HTML fixture is needed and the DDB parser stays out of the benchmark.

## R3 — Question set authoring

**Decision.** `apps/server/bench/retrieval/questions.json`: about 60 questions (floor 50, the schema minimum), about 8 per
document, each with an `id`, `question`, `style` (`lexical` or `paraphrase`), and `expected` (one
or more `{ doc, quote }`). At least half are `paraphrase`: phrased as a player would ask, without
the passage's distinctive terms ("Can I still fight after I'm knocked out?" for the unconscious
condition). This keeps the set from favoring `fts`. A `quote` is a short exact excerpt (40–300
chars) that answers the question.

The loader parses every document, then resolves each quote with `indexOf` on the parsed
`ParsedBook.text`. Zero or two-plus occurrences fail the load and name the question id. This
catches typos and ambiguous quotes before any run.

## R4 — Matching an expected passage to chunks

**Decision.** Span overlap. A retrieved passage is a hit for question *q* when its book equals
the expected `doc` and `overlap([p.start,p.end), [q.start,q.end)) ≥ 0.5 × (q.end − q.start)`.
Any expected passage satisfies the question.

**Why.** Every chunking strategy produces spans into the same document text (chunk invariant 1,
spec 017), so one quote span compares across strategies. Containment ("chunk contains the whole
quote") fails fine-grained strategies whenever a quote crosses a block boundary. Pure anchor
equality (heading path) is too coarse: one heading can hold many answers. Half-overlap accepts a
chunk holding most of the answer and rejects one that only grazes it.

## R5 — What "dimension" varies

**Decision.** No schema change. The schema pins `vector(1024)` and `dim = 1024`
(decision-0002); the gateway requests `dimensions: 1024` and rejects any other length. The bench
varies dimension *below* 1024 by truncation: take the first *d* components of the 1024-dim
vector, L2-renormalize, zero-pad back to 1024. Cosine similarity on the padded vector equals
cosine on the truncated one, so the stored rows answer "how good is this model at *d* dims".
The row records `dimMethod: "native" | "truncate"`.

A bench-only wrapper around `gateway.embed` does the truncation and rewrites the returned model
name to `<model>@<d>`. `retrieve` takes the wrapper as its `gateway` dependency, so the question
vector is truncated the same way and the model filter matches. `retrieve.ts` does not change.

**Ceiling.** A model with a native maximum below 1024, or one that cannot return 1024 dims,
cannot be benchmarked: the gateway rejects it. Admitting one needs a gateway change (pass-through
dims) and a padding rule in `attachEmbeddings`. That is an **OPERATOR CHECKPOINT** and a new
card, not this task. Dims above 1024 would need a schema change and are rejected by matrix
validation.

## R6 — Chunking strategies

**Decision.** A strategy is `{ name, maxChars }` passed to the existing `chunkBook`. The full
matrix example lists `block` (0), `c1000`, `c2000` (today's default), `c4000`. A new chunking
algorithm is a later card (YAGNI).

## R7 — Isolation (TASK-0033 caveat)

**Decision.** The bench writes only to its own database, never the app's. The bench URL is
`BENCH_DATABASE_URL` when set; otherwise the base URL (`TEST_DATABASE_URL || DATABASE_URL`, the
precedence `db:migrate` uses) with the database name suffixed `_bench`. The bench creates that
database when absent (`CREATE DATABASE`), applies migrations with drizzle's migrator, and
refuses to run when the bench URL equals the base URL. It stores through `storeParsedBook` and
`attachEmbeddings` and never enqueues a job. No ingest worker polls the bench database, so no
job theft is possible.

Within one run, strategies share the database in sequence: before each strategy the bench
deletes every `library_documents` row in the bench database (cascade), stores the corpus
chunked by that strategy, then embeds it once per (model, dim). Models coexist because vector
search filters by model name.

**Rejected.** A Postgres schema per run (drizzle table objects are schema-bound; retrieval's
queries would need rewriting). Running through ingestion jobs (the caveat itself). Sharing the
test database (the bench's delete would wipe other suites' rows).

## R8 — The per-commit case

**Decision.** A vitest integration case, `apps/server/test/bench/retrieval.integration.test.ts`,
runs inside `pnpm test` and so inside `ci:check`. It uses the loud-skip harness; under
`REQUIRE_DATABASE=1` it cannot skip. **No CI workflow change.**

Embedding: a bench-local `bow` provider (hashed bag-of-words). Lowercase, split on non-letters,
drop a small stop list, strip a trailing `s`, hash each token (FNV-1a) into one of 1024 buckets
with a hash-derived sign, L2-normalize. It is injected through `createGateway`'s `adapters`
option under kind `fake`. It is deterministic and network-free, and unlike the gateway's
`hashEmbed` (random per text), it gives meaningful similarity, so vector and hybrid recall are
real numbers. It lives under `apps/server/src/bench/`, not `src/ai/`.

CI matrix (`matrices/ci.json`): model `bow` at dims `[1024, 256]`, strategies `block` and
`c2000`, all three modes. That is 10 cells (fts runs once per strategy).

**Baseline and threshold.** `apps/server/bench/retrieval/baseline.json` holds recall@5 per cell
key plus the corpus, question, and matrix hashes. The case fails when a cell's recall@5 is below
`baseline − 1/N` (N = question count: one question of slack for tie-order noise). It fails when
a hash differs from the baseline's, so a corpus or matrix edit forces a deliberate baseline
update (`--write-baseline`). A value above baseline passes and prints a raise-the-baseline
notice. The case writes no results file.

## R9 — Results storage

**Decision.** One JSON file per run in `apps/server/bench/retrieval/results/`, named
`<YYYY-MM-DD>-<sha7>-<runId8>.json`. The directory is tracked, not gitignored: a run worth
comparing is committed; a scratch run is deleted. Files hold ids, spans, hashes, and numbers,
never corpus text (constitution VIII). `schemaVersion: 1`. The `report` subcommand reads every
file and prints one table grouped by `corpusHash`.

**Rejected.** A database table (results would die with a stack; comparisons over time need
them in git). JSONL append log (merge conflicts across branches). Gitignored results (defeats
"compare over time").

## R10 — Cost and the paid-run guard

**Decision.** Cost comes from the gateway's own `UsageRecord`s via `memorySink()`, split into
corpus and question phases. `costUsd: null` from any record makes the phase cost `null`. Before
any run, the CLI computes an estimate: corpus chars ÷ 4 × strategies × models, plus questions ×
(vector and hybrid cells), priced by `AI_PRICES`. Any provider whose kind is not `fake` requires
`--allow-paid`; without it the CLI prints the estimate and exits 2. `--dry-run` prints the
estimate and exits 0 with no database write.

**OPERATOR CHECKPOINT.** Before the first paid run the implementer stops and reports the
provider list, model list, dims, strategies, and the printed estimate. The operator supplies
`AI_PROVIDERS`, `AI_PURPOSES`, `AI_PRICES`, and keys; the implementer never sees or commits a
key. Rough scale: about 60k corpus tokens × 4 strategies × 2 models ≈ 0.5M tokens, well under
one dollar at current embedding prices.

## R11 — Where the code lives

**Decision.** Code in `apps/server/src/bench/retrieval/` (typechecked by the server's existing
`tsc -b`, compiled to `dist/`, importable by tests). Data in `apps/server/bench/retrieval/`.
The CLI runs as `node dist/bench/retrieval/cli.js` after a build, through a server package
script and a root pass-through `bench:retrieval`. `bench/` is outside every boundary zone and
imports library modules the way tests do. Arguments are parsed with `node:util` `parseArgs`.

**No new runtime dependency.** `pdftotext` is an authoring-time tool, used once, not committed.

**Ceiling.** `dist/bench/` ships in the runtime image (a few KB). `ponytail:` exclude it when
the image is trimmed.
