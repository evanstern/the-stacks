# the-stacks — Architecture

**Status:** ratified 2026-09-21 (design session, operator + Claude) — A1–A9 approved as proposed.
**Revised 2026-10-25** (re-centre session, operator + Claude; decision-0009 to decision-0021,
session record doc-0004): A4, A6, A7 and A8 revised; A10–A14 added. Superseded text is kept
and marked with the decision that superseded it.
**Companions:** [vision.md](vision.md), [milestones.md](milestones.md)

## A1. Stack

**Recommendation: TypeScript end-to-end, Postgres for everything, no Python
service in V1.**

Why TS is genuinely the best tool here, not just the familiar one:

- The hard surfaces of this project are the **web client** (chat, codex, and a
  WebGL tabletop) and the **realtime server** (event streams, rooms,
  hidden-information authority). Both are native TS territory.
- The AI layer in this design is **agent orchestration**: structured output
  against Zod schemas, a fixed turn pipeline (A11), streaming into the event log.
  There is no model training, no tensor work — nothing that needs Python.
  (The original text cited the Anthropic TS SDK; decision-0007 superseded that —
  no vendor SDK, adapters on stdlib `fetch`.)
- One language means the **content contracts** (A5) are single-source: the same
  Zod schema validates an NPC at the API boundary, in the agent's tool
  definition, and in the client form. The same holds for engine commands,
  events and proposals (A10).
- Where Python earns a place later (local embeddings, local diffusion,
  ComfyUI), it enters as an **optional sidecar behind an existing provider
  seam** (A7, A8) — an additive container, not a rewrite.

Concrete choices:

| Layer | Choice | Note |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | |
| Server | Node 22, **Hono** + `ws` | One process serves REST + WebSocket; Hono is small, typed, and portable |
| Client | React 19, React Router 8 framework mode (SSR by default; realtime and canvas routes client-only), Tailwind v4, shadcn/ui | Supersedes "SPA, not SSR": doc-0003 / decision-0008 (2026-09-29) |
| Table view canvas | **PixiJS v8** (WebGL) | Tokens, grid, fog; DOM overlays for UI. The in-app table view (A8, A13) |
| DB | **Postgres 17 + pgvector** | Relational + vectors + job queue (SKIP LOCKED) + event log. One stateful container |
| ORM | Drizzle | |
| Validation | Zod everywhere | Schemas are the content contracts, engine commands, events and proposals |
| Auth | Lucia-style session auth, self-rolled tables | Operator + invited players; no external IdP |
| Compose | `web` (static via server), `app` (Node), `db` (Postgres) | **Two containers + volume** for V1 |

## A2. Service topology

One Node process (`app`) hosting: REST API, WebSocket gateway, background
worker loop (Postgres job queue), and the agent runtime. The DM runtime's turn
jobs (A11) run on the same worker loop as ingestion jobs. Compose splits worker
into its own container **only when** ingestion, image or turn jobs measurably
starve the event loop — the code is structured so that split is a config change.

skipped: microservices; add when a subsystem needs independent scaling, proven by load.

## A3. Three data planes

Everything in the app lives in exactly one of three planes, and the planes
have different write disciplines:

1. **Library** (imported books): immutable after ingestion. Documents →
   chunks → embeddings → citations. The RAG substrate.
2. **Codex** (campaign content): mutable, versioned entities — NPCs, PCs,
   locations, maps, encounters, items, factions. CRUD via API; every entity
   validates against its content contract (A5).
3. **Session** (play): append-only **event log** per game session. Never
   updated, only appended. Client state and AI context are both projections
   of this log.

The SRD 5.2.1 baseline (decision-0012) is not a plane: it is versioned data that
ships with the engine package, read-only at runtime. Structured records extracted
from an operator's imports (M5) are derived from library documents and live in the
library plane with them.

## A4. Event-sourced sessions

> **Revised 2026-10-25** by decision-0015 and decision-0017: the server now validates
> through the **gate and the 5e engine** (A10) rather than "the structured core (A6)",
> and the DM is a turn pipeline (A11). Everything else in A4 stands.

A game session is a stream of typed events (`talk`, `action.declared`,
`action.committed`, `roll`, `proposal.created`, `damage.applied`,
`initiative.set`, `token.moved`, `map.revealed`, …) in a Postgres table
`(session_id, seq, actor, type, payload, ts)`.

- Clients subscribe over WebSocket from a `seq` cursor; reconnect = replay.
- **Authority:** all mutations go through the server; the server passes every
  proposed change through the gate and the 5e engine (A10) and appends only what
  they produce. Hidden information (DM notes, secret trackers, pending
  proposals, unrevealed map regions) lives in events with a `visibility` field;
  projections filter per viewer.
- **Projections are the state.** Scene, party, encounter and journal are
  projections of the log; nothing else holds session state (decision-0017
  layer 1).
- **The AI DM is just another actor.** The AI DM consumes the same event
  stream as context and emits the same events as everyone else — through the
  same gate. This is the single most important decision for the end goal:
  build the table so an agent can sit at it.

## A5. Content contracts (agent-loadable content)

Every codex entity type has a Zod schema with three mandatory sections:

- `identity` — mechanical truth (stats, AC, HP), in the 5e engine's record
  shapes (A10). *(Was "per the active system module"; decision-0010.)*
- `portrayal` — voice, mannerisms, appearance, motivations; written to be
  *performable* by an agent
- `hooks` — relationships to other entities (typed edges), secrets, agendas

Rule: **an entity is complete when an agent given only that entity + its
linked neighbors can generate new in-character content.** This is testable and
becomes a CI-able lint ("portrayal completeness") plus an eval.

## A6. Game system: 5e only

> **Superseded 2026-10-25** by decision-0010 (5e only). The original text — a
> system-agnostic core behind a system-module interface, shipping `dnd5e` at full
> depth plus `fate-core` as a deliberately alien conformance module, with CI
> running the conformance suite against both — no longer binds. Constitution
> Principle VI was amended to match (constitution 2.0.0).

The platform supports **D&D 5e only**. Mechanics live in one pure engine package
behind a narrow entry point (A10). That boundary is kept because it is cheap and
keeps mechanics testable and out of session, library and codex code — not to admit
a second system. There is no system-module interface, no second system and no
conformance suite.

## A7. AI gateway

> **Revised** by decision-0007 (2026-09-28: provider-agnostic, no vendor SDK —
> supersedes "Anthropic first; OpenAI-compatible second") and decision-0017
> (2026-10-25: the DM is a pipeline of nodes, A11 — supersedes "agents are
> tool-loops" for the DM).

One internal gateway wraps all model calls: named provider config, per-purpose
model selection (cheap model for extraction and audit, strong model for
narration and adjudication), token/cost accounting per campaign, and
prompt-template versioning. Local models arrive as just another
OpenAI-compatible endpoint — a config entry, not a feature.

Every LLM call names a **purpose**. The DM runtime's purposes are `dm.director`,
`dm.interpret`, `dm.adjudicate`, `dm.narrate`, `dm.audit`, `dm.chronicle` and
`dm.companion`; the rules answerer's is `answering`. Model choice per purpose
stays in config.

Every LLM output that would change state is a typed **proposal** to the gate
(A10), never a direct write. Narrow agents outside play (rules answerer, and the
M4 campaign-prep agents such as the NPC-smith) may remain tool-loops over the
gateway; whether a graph framework hosts them is decided by TASK-0054 (A11,
"No LangGraph now").

## A8. Media pipeline (maps + portraits)

> **Revised 2026-10-25** by decision-0013: the "own minimal VTT" posture became
> "our server owns state; own table view plus adapters" (A13). Map generation,
> UVTT export and portraits are unchanged.

**Maps are data first.** The map-planner agent emits a `MapPlan` JSON (rooms,
walls, doors, terrain, furniture, grid dims — Zod-validated); a deterministic
renderer draws it from a bundled CC0 tile/asset pack. Grid, walls, and fog are
correct by construction. Export: PNG + **Universal VTT** JSON (walls/lights/
grid). Map placement, token movement and fog reveals are session events, so the
in-app table view and any VTT adapter (A13) project the same truth. A diffusion
styling pass over the render is not planned; it needs a decision record and a
card before work starts (A14).

**Portraits** go through an image-provider seam (same shape as A7): cloud
image APIs first, local ComfyUI later. Every generated asset stores its
prompt + provider + seed alongside — regenerability is part of the contract.

## A9. Rulebook ingestion

BYO content: operator uploads D&D Beyond HTML exports — **the supported import**
(decision-0011) — plus generic HTML/Markdown (best-effort, as built in M1).
Pipeline: parse → structural chunking (headings/tables preserved) → embed →
hybrid retrieval (vector + FTS) → **citations carry source anchor** (book,
section, exact quote span) so every answer is verifiable. The eval harness from
v1 is re-derived, not ported: a fixtures-based retrieval QA suite runs in CI.

Structured extraction (M5, decision-0012): stat blocks and spells in DDB imports
are extracted into the engine's record shapes and layered over the SRD 5.2.1
baseline, so the engine can run an imported monster. Extracted records stay in
the operator's database volume.

Licensing posture: imported content stays in the operator's DB volume; nothing
generated ships book text beyond quoted citations shown to the operator who
supplied the book. The project ships only openly licensed SRD 5.2.1 data, with
its required CC-BY-4.0 attribution (decision-0012).

## A10. The gate and the 5e engine

*Added 2026-10-25 — decision-0015, decision-0017, decision-0021.*

The second of four runtime layers (A11). It holds **no LLM**.

**The engine** is a pure function:

```
(state, command, rng) → events | refusal
```

- Zod-typed commands, events and refusals.
- Seeded RNG; tests inject scripted dice, so every roll is reproducible.
- Scope: dice expressions (`4d6kh3`, advantage, bonus dice), HP and temporary HP,
  conditions as data, initiative and turn order, life states and death saves,
  rests, spell slots. Effects beyond these primitives resolve by cited
  adjudication (A11), then reach the engine as primitive commands.
- Every roll event carries its reason; every state-change event carries before
  and after values. This is the **roll ledger** (decision-0021 idea 2).
- **Refuse before write.** An illegal command returns a refusal with a specific
  error code and produces no events.
- Mechanics data: the SRD 5.2.1 baseline, compact lookup records of about 100
  tokens each for prompts (decision-0012, decision-0021 idea 7).

**The gate** wraps the engine. Every LLM output and every player action is a
typed **proposal**; the gate decides what happens to it.

| Policy | Effect | Serves |
|---|---|---|
| `auto` | Apply immediately through the engine | Goal 3: the AI runs the game |
| `ask` | Append `proposal.created` (DM-only); apply on `proposal.approved` | Goal 4: the AI assists a human DM |
| `suggest` | Show the proposal; the DM issues their own command | Goal 4, lighter touch |

- The policy is set **per proposal kind**. The policy table is the autonomy dial.
- A human DM's own commands go through the same engine, already approved.
- Player actions are proposals too; their policy is the commit authority of the
  current table mode (A12).
- Pending proposals are events: they survive restarts and are filtered per
  viewer by the log's visibility rules.

Cards: TASK-0042 (engine), TASK-0045 (gate).

## A11. The DM runtime and the turn pipeline

*Added 2026-10-25 — decision-0017, decision-0018, decision-0019.*

Four layers; only one holds an LLM:

1. **Session event log** (M0, built) — the only source of truth (A4).
2. **Gate + 5e engine** (no LLM) — A10.
3. **DM runtime** — an actor like any player. Holds every LLM call.
4. **AI gateway** (built) — every node names a purpose (A7).

```
 ┌─ CLIENTS (players, human DM, VTT adapters) ──────────────────────────────┐
 │  subscribe to the log from a cursor · send talk/actions · DM approves     │
 └──────────────▲────────────────────────────────────┬──────────────────────┘
                │ events (filtered per viewer)       │ action.committed / proposal.approved
 ┌──────────────┴────────────────────────────────────▼──────────────────────┐
 │  SESSION EVENT LOG  (M0, built)    the only source of truth              │
 └──────▲───────────────────────────────────▲───────────────┬───────────────┘
        │ applied events                    │ proposal.*    │ enqueues a turn job
 ┌──────┴────────────────┐   proposals ┌────┴───────────────▼───────────────┐
 │  GATE + 5E ENGINE     │◀────────────│  DM RUNTIME (actor; turn job on    │
 │  (pure, no LLM)       │  refusals ─▶│  the jobs queue)                   │
 │  policy auto/ask/     │             │  every LLM call → AI GATEWAY       │
 │  suggest + commit auth│             │                                    │
 └───────────────────────┘             └────────────────────────────────────┘
```

**Turn jobs.** A committed action enqueues a turn job on the existing Postgres
jobs queue — the claim, lease and fencing machinery built for ingestion. A
crashed worker's turn is reclaimed, and a fenced-out worker cannot write.

**The pipeline.**

```
 assemble → director → interpret ─┬─→ adjudicate ─┐
                                  └───────────────┴→ resolve → narrate → audit
                                       off the hot path: chronicle (proposals)
```

| Node | LLM | Job |
|---|---|---|
| `assemble` | no | Build the turn context: projections, recent log, codex neighbours (in M2: the scene seed) |
| `director` | `dm.director` | Own the scene goal and its end, run secret trackers, switch table modes, decide when a beat resolves (decision-0018) |
| `interpret` | `dm.interpret` | Read intent: is a roll needed? combat? a rules question? |
| `adjudicate` | `dm.adjudicate` | When needed: rule on the situation with library retrieval; the ruling carries citations |
| `resolve` | no | Turn the ruling into proposals; send them through the gate; collect dice and events |
| `narrate` | `dm.narrate` | Tell only what `resolve` produced; results arrive as facts |
| `audit` | `dm.audit` | Checks plus a cheap LLM: does the narration agree with the ledger? On failure, regenerate and flag; never ship silently |
| `chronicle` | `dm.chronicle` | Off the hot path: journal and codex updates, as proposals |

AI companions are actors too: each declares and commits actions through the same
action path and gate as a human player (`dm.companion`).

**Ordering is the anti-cheat.** Dice resolve before narration. The narrator never
rolls, never computes, and cannot contradict the ledger without `audit` catching
it.

**The node seam.** Each node is a plain async function
`(TurnContext) → NodeResult`. The pipeline is a fixed order with two conditional
branches (adjudicate or not; regenerate on audit failure), not a dynamic graph.

**No LangGraph now** (decision-0019). LangGraph's checkpointer would duplicate
the event log, `interrupt()` would duplicate proposals-as-events, and its run
scheduling would duplicate the jobs queue; its `@langchain/core` peer dependency
pulls against decision-0007. The plain-function seam lets a `StateGraph` wrap the
nodes later. **Trigger** for revisiting: the second agent graph lands (M4
campaign prep: NPC-smith or the encounter builder), or a node needs dynamic
routing among more than two branches or a cycle. Card: TASK-0054.

**Doctrine.** DM-style prompts are written as right/wrong pairs, adapted from
tabletop-dm (MIT, attributed): short turns ending on a demand for action, no
option menus, never move or feel for a player's character, roll only when the
outcome is uncertain, failure is interesting and trying costs something,
fail-forward, and every NPC has a voice, a want and one specific detail
(decision-0021). Playtests check the doctrine (TASK-0048).

Card: TASK-0046.

## A12. Talk, action and table modes

*Added 2026-10-25 — decision-0016, decision-0014.*

Two message concepts, possibly one composer:

- **Talk** — in-character or out-of-character chatter. Never changes state.
  Never triggers a DM turn. The narrator may chime in as talk (for example when
  mentioned), but talk cannot roll or move anything.
- **Action** — a declaration that a character does something. Lifecycle:

```
 declared ──▶ discussed ──▶ committed ──▶ resolved
             (anyone comments)   │
                                 └──▶ turn job (A11) — only committed actions reach the DM
```

**Commit authority** depends on the table mode. The Director switches modes.

| Mode | Who commits | Everyone else |
|---|---|---|
| Turn mode (combat, initiative) | The active player, for their turn | Talk and suggest |
| Free mode (exploration, social) | The declaring player, for their own character | Talk and suggest |
| Party-scope action in any mode ("we take the left tunnel", "we long rest") | Group sign-off | Approve or object |
| Always | The DM (human or AI) may commit or override | — |

Player actions are proposals with a sign-off policy, through the same gate as
A10.

**Concurrency.** Nothing is cancelled. Actions committed while a turn resolves
queue into the next beat and resolve together in log sequence order. The
Director decides when a beat resolves.

**Table size.** The First Scene seats one human plus AI companions; the protocol
is multi-actor from day 1 (decision-0014). Group sign-off, floor passing between
humans, presence and narrator chime-in rules arrive in M3 (TASK-0049 to
TASK-0052). The WebSocket protocol omits presence today by design; TASK-0051
decides how to add it.

Cards: TASK-0044 (events and projections), TASK-0045 (commit authority),
TASK-0047 (composer and commit control).

## A13. VTT: ports and adapters

*Added 2026-10-25 — decision-0013. Supersedes the table part of A8 and vision's
"own minimal VTT in-app".*

**Our server owns state.** No external VTT can hold authoritative state for an
AI DM: none offers server-enforced hidden information, refuse-before-write and a
replayable log. Every table surface is therefore a projection of the session
log through a port.

```
                      ┌──────────────────────────────┐
                      │ SESSION EVENT LOG + GATE      │  (source of truth)
                      └──────┬──────────────┬────────┘
             table port      │              │      export port
     ┌───────────────┬───────┘              └────────┬───────────────────┐
     ▼               ▼                               ▼                   ▼
 in-app table   live adapter                  UVTT export        Obsidian vault
 view (ours)    Foundry or Owlbear            (maps)             export (codex)
                (one, chosen in M6)           FG / Atlas: export targets only
```

| Target | Role | Why |
|---|---|---|
| In-app table view | First-class; built first (TASK-0047 is its first slice; maps in M6) | We control visibility and the gate |
| Foundry VTT | Candidate live adapter (M6) | Document API, module system, sockets; a small module can hold a WebSocket to our server |
| Owlbear Rodeo | Candidate live adapter (M6) | Clean SDK; maps and tokens only |
| Fantasy Grounds Unity | Export target only | Closed client; sandboxed extensions with no documented network or file I/O |
| Atlas VTT | Export target only | Pre-1.0, no API, undocumented map format; its Obsidian appeal is met by the vault export |
| Obsidian vault | Codex export (M6) | Markdown with frontmatter; the operator's management surface |
| Universal VTT | Map export (stays) | Walls, lights, grid for any VTT |

A live adapter sends talk, actions and approvals in, and receives
viewer-filtered events out — exactly what a first-party client does. It never
writes state directly.

## A14. Planning principle

*Added 2026-10-25 — decision-0020.*

**No unplanned "for now".**

- Build known-wanted work now, or defer it only with ordered board tasks created
  at the same time.
- Give a maybe a revisit task tied to a concrete trigger.
- Reject a design or spec change that adds a "for now" without a card or a
  revisit trigger.
- Card every known-wanted milestone up front.
- Refine cards at each milestone's planning. Never drop a card silently;
  dropping one needs a decision record.

Applied in the 2026-10-25 revision: every milestone from M2 to M9 is carded
(TASK-0042 to TASK-0053, TASK-0056 to TASK-0091; per-milestone lists in
milestones.md). The two maybes have revisit cards: TASK-0054 (LangGraph) and
TASK-0055 (parked tabletop-dm combat rules). M9 is a sketch; its re-plan card
(TASK-0087) gates every other M9 card and refines them from V1 play evidence.

The pre-existing "skipped:" line in A2 (microservices, when load proves a need)
is a deferral with a stated trigger, which satisfies this principle.
