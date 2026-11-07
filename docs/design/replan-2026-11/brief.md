# Replan 2026-11 — assignment brief

**Opened:** 2026-11-06 by the operator. **Branch:** `replan-2026-11` (worktree `.worktrees/replan`).
**Precondition met:** root `main` equals `origin/main` (5276970e); zero open PRs.

## Ask

Rework the product plan from the end goals backward. Weigh every open board card, the
codebase, the wiki, and the design docs against those goals.

## End goals (operator, 2026-11-06)

1. A player sits down alone; an AI DM runs a full campaign start to finish (vision.md).
2. A top-notch human table: human or AI DM, multiplayer. Co-equal with goal 1; the plan proposes the order.
3. UX is first-class: talking to the DM, players and NPCs; combat; text play and VTT play both.
4. Campaign creation: generators (donjon-style, campaign-integrated), a campaign notebook,
   editors for NPCs, encounters, storylines, items, dungeons and loot. Human DM and AI co-author.

## Rulings (operator answers, 2026-11-06)

| Topic | Ruling |
|---|---|
| Board authority | Do anything to Backlog.md on branch `replan-2026-11`. Root `main` stays untouched. |
| In-flight work | Frozen. No sweeps or merges until the new plan is approved. M3 work may be re-scoped or killed. |
| Decisions | Every decision record is open to supersession, with rationale, for ratification. |
| Projects | Separate repos or published libraries may be proposed. |
| VTT | Research build-vs-embed-vs-adapter and recommend. Operator decides. |
| Campaign-tool user | Human DM and AI equally. AI generates, human curates, both play from it. |
| Constitution | Major-version rewrite of `.specify/memory/constitution.md`. |
| Stack | Open to change, with rationale. |
| Deliverable | Local HTML hub with visuals plus markdown source docs plus the branch board. |
| Tiers | Opus-tier subagents authorized for design and research. Sonnet/haiku for mechanical work. |
| Budget | No hard cap. Report usage. |

## Deliverables

1. Fully reworked Backlog board (on the branch).
2. New constitution (major version).
3. Wish list: end goals → features → capabilities → architecture.
4. Plan of action: projects, workstreams, parallel seams, sequencing, approval checkpoints.
5. HTML hub with UI/UX wireframes and architecture diagrams.

## Phases

1. Discovery — parallel research files under `research/`.
2. Synthesis — wish list and target architecture.
3. Constitution, plan and board rework.
4. HTML hub. Operator approval checkpoints are listed in the hub.
