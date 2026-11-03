# Feature Specification: Scene-start intros

**Feature Branch**: `task-0171-scene-start-intros`

**Created**: 2026-11-02

**Status**: Draft

**Input**: TASK-0171. "The first narration of a scene grounds the players. It covers where the
party is, why they came, who each party character is and who plays them, which NPCs are present,
and what the party is there to do. Then it asks what they do." Evidence: the 2026-10-28
two-browser alpha playtest (`docs/playtests/2026-10-28-two-browser-alpha.md`), items 4 and 6.

`speckit-specify` ran as authoring guidance only: the spec dir was already claimed with a stub, so
its branch and directory steps were skipped. `speckit-clarify` was skipped: the card, runbook B
(`docs/design/m3-runbook-b-resolution-quality.md`, lane B4, spine #17) and the code settle every
choice below except the open questions at the end, which carry a recommended default.

## Background: what happens today

1. The scene-start narrate prompt receives two scene lines: `Open the scene. Framing:
   <opening.framing>` and `Location: <name>. Mood: <mood>`. The framing is one sentence. It names
   no party character and no NPC.
2. The seed has no field that says why the party is here.
3. The location features and senses, the goal statement, each party character's class and look,
   and each NPC's role and look all exist in the player-facing seed view. None reaches the
   opening.
4. The prompt's "Present characters" list at scene start comes from the Director's chosen beat's
   `npcIds`. In the duo seed the first beat lists no NPC ids, yet it declares Wenna Marsh
   `present`. So Wenna is missing from the list, and she first appears mid-narration on the next
   beat (playtest item 6).
5. The audit checks the opening like any other narration. Nothing checks that it introduces
   anyone. The fallback for a scene start ships the framing sentence alone.

Captured evidence: in run `verify-20261026T192319Z` (`specs/034-narration-quality/evidence/`) the
opening names Tamsin Vale, Brother Odo and Kestrel and never names Wenna Marsh, who is present.
In run `run5-20261026T171359Z` the opening names nobody.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The opening tells the table where they are and why (Priority: P1)

A player joins a table and the scene starts. The first narration says where the party is, why
they came, and what they are there to do, so the player is not dropped into the middle of a
campaign.

**Why this priority**: card AC #1 and #2, and playtest item 4.

**Independent Test**: load each shipped seed; each has a premise. Build the scene-start prompt for
each seed; it carries the location's features, mood and senses, the premise and the goal.

**Acceptance Scenarios**:

1. **Given** a seed without an opening premise, **When** the loader reads it, **Then** it fails with
   an issue naming the premise.
2. **Given** any shipped seed, **When** the loader reads it, **Then** it loads and its premise is
   non-empty.
3. **Given** a scene start, **When** the narrate prompt is built, **Then** it holds the location
   name, features, mood and senses, the premise, the goal statement and the framing.

---

### User Story 2 - The opening introduces everyone in the scene (Priority: P1)

The first narration names each party character and each NPC present at the first beat before it
asks the party what they do. A player knows who is at the table and who is in the room.

**Why this priority**: card AC #2 and #3, and playtest item 6 (Wenna first appeared
mid-narration).

**Independent Test**: start the duo seed's scene through the real queue on the fake gateway and
read the shipped narration row. It names Tamsin Vale, Brother Odo, Kestrel and Wenna Marsh before
its closing question.

**Acceptance Scenarios**:

1. **Given** a scene start, **When** the narrate prompt is built, **Then** it lists each party
   character with its class, look and controller (a human player or an AI companion).
2. **Given** a seed whose first beat declares an NPC `present` but lists no NPC ids, **When** the
   scene starts, **Then** that NPC is in the prompt's list of present characters.
3. **Given** an NPC the first beat declares `absent`, **When** the scene starts, **Then** that NPC
   is not in the list.
4. **Given** a scene start, **When** a narration ships, **Then** it names every party character and
   every present NPC before its closing question.

---

### User Story 3 - An opening that leaves someone out is caught (Priority: P1)

If the model writes an opening that omits a party character or a present NPC, the audit flags it,
the narration is regenerated, and the table never sees an opening that leaves someone out.

**Why this priority**: card AC #4.

**Independent Test**: run the audit's code checks over the captured `verify-20261026T192319Z`
opening with the Greyhollow Ford facts. They report one blocking issue that names Wenna Marsh.

**Acceptance Scenarios**:

1. **Given** a scene-start narration that omits one party character, **When** the audit runs,
   **Then** it reports a blocking issue naming that character.
2. **Given** a scene-start narration that omits a present NPC, **When** the audit runs, **Then** it
   reports a blocking issue naming that NPC.
3. **Given** a scene-start narration that names someone only inside its closing question, **When**
   the audit runs, **Then** that name does not count.
4. **Given** a narration on any other trigger, **When** the audit runs, **Then** this check does not
   run.
5. **Given** three openings that each omit someone, **When** the audit loop ends, **Then** the
   fallback ships, and the fallback names every party character and every present NPC.

---

### User Story 4 - No secret reaches the opening (Priority: P1)

The richer opening prompt uses only player-facing seed fields. No secret, no NPC knowledge, no
beat summary and no DM-only goal text reaches it.

**Why this priority**: card AC #5.

**Independent Test**: build the scene-start prompt for every shipped seed. It holds none of that
seed's DM-only strings.

**Acceptance Scenarios**:

1. **Given** each shipped seed, **When** the scene-start prompt is built, **Then** none of the
   seed's DM-only strings appears in it.
2. **Given** the opening builder, **When** it is called, **Then** it accepts only the player-facing
   seed view, never the full seed.

### Edge Cases

- A present NPC the fiction keeps out of sight (Wenna in the ferry-house loft) is still named. The
  prompt lets the narrator name her as heard, expected or glimpsed.
- An NPC declared `yielded` at the first beat is in the scene, so it is named.
- A party with no members (a human DM's pending scene start) makes the name check vacuous.
- A one-word name ("Kestrel", "Snag") matches as a whole word only. "Snagged" does not name Snag.
- A multi-word name matches by its full name or its given name ("Odo", "Wenna"). A family name
  alone ("Marsh") does not count. An NPC alias ("the keeper") does not count.
- The opening is longer than a beat narration. It stays under the audit's existing hard word cap.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The seed's opening MUST carry a premise: a short player-facing statement of why the
  party is here.
- **FR-002**: The seed loader MUST reject a seed without a premise, with an issue that names the
  field.
- **FR-003**: Every shipped seed MUST fill the premise. A premise MUST NOT state a DM-only fact.
- **FR-004**: The player-facing seed view MUST carry the premise.
- **FR-005**: The scene-start narrate prompt MUST carry the location name, features, mood and
  senses; the premise; the goal statement; and the framing.
- **FR-006**: The scene-start narrate prompt MUST list each party character with its class, look
  and controller kind ("a human player" or "an AI companion").
- **FR-007**: At scene start, the present NPCs MUST be every seed NPC that the first beat declares
  `present` or `yielded` and whose logged presence after the scene-start rows is not `absent`. The
  Director's beat choice and the beat's NPC ids MUST NOT narrow this list.
- **FR-008**: The scene-start narrate prompt MUST list each present NPC with its name, role and
  look.
- **FR-009**: The scene-start narrate prompt MUST tell the narrator to name every listed party
  character and present NPC before the closing question.
- **FR-010**: The scene-start narrate prompt MUST tell the narrator to end on one open question in
  its own words, and never on the literal "What do you do?".
- **FR-011**: The scene-start prompt MUST be built from the player-facing seed view only.
- **FR-012**: The audit's code checks MUST report a blocking issue for each party character and
  each present NPC a scene-start narration does not name before its closing question.
- **FR-013**: The check in FR-012 MUST run only on the scene-start trigger.
- **FR-014**: The scene-start fallback MUST name every party character and every present NPC.
- **FR-015**: Narrations on every other trigger MUST be unchanged by this feature.

### Key Entities

- **Opening premise**: a new required seed field beside the framing. Player-facing.
- **Opening section**: the scene-start part of the narrate prompt. It replaces today's two scene
  lines.
- **Name check**: a code check in the audit, scene start only, that each party character and
  present NPC is named.

### Card acceptance criteria map

| Card AC | Requirements | Stories |
|---------|--------------|---------|
| #1 premise field, loader requires it, shipped seeds fill it | FR-001 to FR-004 | US1 |
| #2 prompt receives location, premise, goal, party with controllers, present NPCs, from player-safe views | FR-005 to FR-008, FR-011 | US1, US2 |
| #3 narration names every party character and present NPC before it asks, with a test over a captured run | FR-009, FR-010, FR-012, FR-014 | US2 |
| #4 audit flags an opening that omits one, with a test | FR-012, FR-013 | US3 |
| #5 no DM-only seed text reaches the prompt, with a type-level or prompt test | FR-011 | US4 |

AC #3 is met by construction: the name check blocks every opening that omits someone, and the
fallback names everyone. Its test is a scene start through the real queue on the fake gateway. The
first scripted opening omits Wenna, the audit regenerates, and the shipped row names all four. The
captured real-model openings from spec 034's evidence are replayed through the check (AC #4).
Runbook B's playtest row "Scene start (0171)" checks a hosted real-model run.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 4 of 4 shipped seeds load with a non-empty premise.
- **SC-002**: In every shipped scene-start opening, 100% of party characters and present NPCs are
  named before the closing question.
- **SC-003**: The two captured real-model openings are both flagged: one omission in
  `verify-20261026T192319Z` (Wenna Marsh) and four in `run5-20261026T171359Z`.
- **SC-004**: 0 DM-only seed strings appear in the scene-start prompt for any shipped seed.
- **SC-005**: Every existing narration test on a non-scene-start trigger passes unchanged.

## Assumptions

- "Who plays them" means the controller kind, a human player or an AI companion. The Party
  slide-out (TASK-0164) already shows each human's display name. See OQ-1.
- The opening may run longer than a beat narration. The prompt allows about one hundred sixty
  words, never more than one hundred eighty, for the opening only. That stays under the narrate
  node's 1,200-character clip. The audit's hard cap of 220 words is
  unchanged.
- Under a human DM, scene start leaves the party and presence rows pending. The opening then sees
  no party, and the first beat's declaration still limits the NPCs (FR-007). That path ships no
  scene until the human DM acts, and this feature does not change it.
- Spec 074 (TASK-0113, spine #3) lands first and adds a rule that the opening never moves a party
  character. This feature keeps that rule and shows each party character only as present.
- TASK-0204 (spine #18) later adds a code check against the literal "What do you do?". This
  feature only tells the narrator not to write it.
- The knowledge ledger (TASK-0172) later tells known NPCs from strangers. This feature introduces
  every present NPC the same way.

## Open questions (orchestrator rules; default in bold)

- **OQ-1: what "who plays them" puts in the prompt.** **(a) The controller kind only: "a human
  player" or "an AI companion". No display name reaches the model.** (b) Each human's display name
  too, through a new users lookup on the node deps (`pipeline/context.ts`, `worker.ts`), so the
  opening can say who plays whom. (c) A code-rendered table line after the prose, like the dice
  lines, naming each character's player. Note: runbook B's playtest row says the opening "names
  the party, their players and Wenna". Default (a) reads "their players" as the controller kind.
  (b) and (c) send or render user display names and widen the file list.
- **OQ-2: the fallback names everyone.** **(a) Edit the scene-start branch of
  `dm/fallback.ts`, so the fallback names every party character and present NPC (FR-014).** This
  adds `fallback.ts` to TASK-0171's footprint in the runbook's overlap table. It merges at #17,
  after every fallback card except TASK-0214, so the runbook's fallback order holds. (b) Leave
  the fallback as the framing alone; an opening that fails three times ships without names.
- **OQ-3: the opening's length.** **(a) The opening section allows about one hundred sixty words,
  never more than one hundred eighty; the hard cap stays 220 and the 1,200-character clip stays.** (b) Keep one hundred fifty words, the
  beat limit.
