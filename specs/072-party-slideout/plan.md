# Implementation Plan: Party slide-out

**Branch**: `task-0164-party-slideout` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

**Input**: `specs/072-party-slideout/spec.md`, runbook A lane A4
(`docs/design/m3-runbook-a-run3-fixes.md`). This plan assumes OQ-1 (a) and OQ-2 (a). Research,
data model and contracts are small, so they live in this file; there is no separate research.md,
data-model.md or quickstart.md.

## Summary

Class and level become required fields of a seed character and optional fields of a logged party
member. Scene start copies them from the seed onto each party row. The web table gains a Party
trigger and a Party slide-out on the existing `Panel`. A pure `partyRows` function derives each
entry (controller label, own-character marker, class and level, HP, AC) from the projection the
client already holds, presence and the viewer. In turn mode the slide-out reuses the turn-order
list. No new route, no migration, no new dependency.

## Technical Context

**Language/Version**: TypeScript (Node 22), React 19, React Router 8, as the repo.
**Primary Dependencies**: Zod, Vitest, node:test (web). **No new runtime dependency** (C5 not hit).
**Storage**: Postgres event log. `party.member.changed` gains two optional payload fields; the
payload stays v1. No migration.
**Testing**: Vitest and node:test unit tests; one DB integration assertion (`REQUIRE_DATABASE=1`);
Brave screenshots driven over CDP with Node's built-in `fetch` and `WebSocket`.
**Target Platform**: web play route; server seed loader and scene start.
**Project Type**: monorepo web service.
**Constraints**: no modal (`apps/web/test/no-dialog.test.mjs`). Keep TASK-0191's bounded route
height (`routes/play.tsx`, `routes/play-fixture.tsx` unchanged). Frozen contracts untouched
(see OQ-1).
**Scale/Scope**: 12 source and data files, 2 new web files, 2 contract amendments, 1 evidence
script.

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable**: class and level are seed data an agent authors and the loader
      validates. The panel reads projections any client or agent reads.
- [x] **II. Content contract**: no codex entity. The seed schema change is validated at load, with
      a named issue for a missing field.
- [x] **III. Data planes**: session plane only. The seed is read at scene start, as today.
- [x] **IV. Event sourcing**: class and level reach the client only through a
      `party.member.changed` row written by the gate. Old rows still parse (optional fields), so
      replay is unchanged.
- [x] **V. Citations**: no library claim. N/A.
- [x] **VI. 5e engine boundary**: no mechanic. Class and level are labels; HP and AC come from the
      engine combatant the projection already joins. The engine is unchanged.
- [x] **VII. Structured first**: typed fields, a pure view function, then the component.
- [x] **VIII. Operator-owned content**: class is free text the operator authors, not an SRD id.
- [x] **IX. Self-hostable**: no new service, container or dependency.

**Stack conformance**: no departure. **New runtime dependencies**: none.

## Research

- **R1 — Where the client gets party data.** `project()` folds `party.member.changed` rows into
  `p.party`, and `joinParty` joins each member to its engine combatant: `hp`, `ac`, `lifeState`.
  Every viewer receives these rows (`party.member.changed` is always `public`). Only class and
  level are missing.
- **R2 — Why the log, not a route.** The seed route `GET /dm/sessions/:id/seed` is operator-only,
  and a player has no other seed read. Carrying class and level on the party row reaches every
  viewer and the fixture source with no new route or auth (OQ-1 (c) rejected).
- **R3 — Schema widening is safe.** `PartyMemberSchema` is a plain `z.object`: an old row without
  the fields parses, and a new row with them parses. `memberOf` spreads the member, so the gate's
  `before` copy keeps the fields. The `party` proposal's `after` reuses the same schema
  (`gate/proposals.ts`), so the frozen 029 contract text needs no edit.
- **R4 — No snapshot change.** `snapshot/build.ts` `sheetOf` copies named `identity` fields only,
  so new seed fields never reach a prompt. The DM prompts do not need class or level for this
  card. `dm/snapshot/` is not touched.
- **R5 — Seed contents.** The three shipped seeds share identical character `identity` blocks.
  Hit dice, saves, skills and spells give: Tamsin Vale `Fighter` 1 (d10, Str/Con saves), Brother
  Odo `Cleric` 1 (spells, Wis/Cha saves), Kestrel `Rogue` 1 (Dex/Int saves, Stealth). Each has one
  hit die, so level 1. `specs/031-dm-runtime/data/greyhollow-ford.seed.json` is a byte-for-byte
  copy of `apps/server/seeds/greyhollow-ford.json` (`seed.test.ts`), so it changes too.
- **R6 — Display names.** Presence entries (`source.presence`) carry `{ userId, displayName }` for
  connected users. That is the client's only name source for other users (OQ-2 (a)).
- **R7 — Panel and trigger pattern.** Every table slide-out is `Panel` (`components/panel.tsx`:
  right edge on desktop, bottom sheet under `narrow:`) opened by a header button with
  `aria-expanded` and `aria-controls`. Panel content mounts only while open, so the closed panel
  adds nothing to the header height or the scroll container.
- **R8 — Evidence without Playwright.** Prior evidence scripts loaded `playwright-core` from
  outside the repo. Node 22 has global `fetch` and `WebSocket`, enough for the Chrome DevTools
  Protocol: launch Brave headless with `--remote-debugging-port`, read the page target from
  `/json`, set the session and theme cookies (`Network.setCookie`), set the viewport
  (`Emulation.setDeviceMetricsOverride`), click by `Runtime.evaluate`, and save
  `Page.captureScreenshot`.

## Design

### D1 — Seed schema: class and level (FR-001, FR-002)

`apps/server/src/dm/seed/schema.ts`, `SeedCharacter.identity`: add
`class: Text(40)` and `level: z.number().int().min(1).max(20)`, both required. Zod's issue path
names the field, so `parseSeed`'s `SeedError` already names a missing one. Fill all three shipped
seeds and the spec 031 data copy per R5, placing both keys first in `identity`.

### D2 — Party member: optional class and level (FR-003)

`packages/session-model/src/events/party.ts`, `PartyMemberSchema`: add
`class: z.string().min(1).max(40).optional()` and `level: z.number().int().min(1).max(20).optional()`.
`PartyMemberView` extends `PartyMember`, so it gains them with no edit.

### D3 — Scene start writes them (FR-004)

`apps/server/src/dm/nodes/resolve.ts`, `directorOpening`, the `director:party:<id>` submission's
`after`: add `class: c.identity.class` and `level: c.identity.level`. One hunk, nothing else in
the file changes.

### D4 — The fixture carries them

`packages/session-model/src/fixtures/turn-mode-combat.ts`: add `class` and `level` to Ana's
(`"Fighter"`, 3) and Bram's (`"Ranger"`, 3) `party.member.changed` `after`. The combat fixture is
the screenshot fixture (D9), so the evidence shows class and level. Other fixtures stay as they
are and exercise the "not recorded" text.

### D5 — `apps/web/app/play/party.ts` (new): the rows (FR-007 to FR-009)

```ts
export interface PartyRow {
  characterId: string;
  name: string;
  controller: string;      // "You" | display name | "Player (away)" | "Player" | "AI companion"
  isAi: boolean;
  isOwn: boolean;
  classLevel: string | null;   // "Cleric 1"; null when either field is absent
  hp: { current: number; max: number; temp: number } | null;
  ac: number | null;
}
export function partyRows(
  p: Pick<SessionProjections, "party" | "viewer">,
  present: readonly PresenceEntry[] | null,
): PartyRow[];
```

Pure and total, party order kept. Controller label per FR-008: AI → `"AI companion"`; a player
whose `userId` equals the viewer's (`viewer.role === "player"`) → `"You"`; present → the presence
`displayName`; presence known and absent → `"Player (away)"`; presence `null` → `"Player"`.
`isOwn` is the same viewer match. `hp` and `ac` come from `member.combatant` (null when no
combatant).

### D6 — `apps/web/app/play/components/party-panel.tsx` (new)

`PARTY_PANEL_ID = "party-panel"`. `PartyPanel({ rows, order })` renders:

- `rows.length === 0`: "No party yet."
- else `<ul aria-label="Party">`, one `<li>` per row with `data-own` when `isOwn`: the name in
  bold, a "Your character" badge when `isOwn`, the controller label, then one line
  `{classLevel ?? "Class and level not recorded"} · HP {current}/{max}{temp > 0 ? ` (+{temp})` : ""} · AC {ac}`
  (`HP —` / `AC —` when null).
- when `order.length > 0`: a heading "Initiative" and `<TurnOrder order={order} label="Initiative" />`.

Use theme tokens only (`bg-card`, `border-border`, `text-muted-foreground`, `bg-primary`), as the
sibling panels do, so light and dark both hold (FR-011).

### D7 — `TurnOrder` label prop

`apps/web/app/play/components/turn-order.tsx`: add an optional `label` prop, default
`"Turn order"`, used as the `aria-label`. The strip under the header is unchanged.

### D8 — Header trigger and wiring (FR-005, FR-006, FR-012)

- `components/table-header.tsx`: props `partyOpen: boolean` and `onParty: () => void`. A `TRIGGER`
  button "Party" with `aria-expanded={partyOpen}`, `aria-controls={PARTY_PANEL_ID}` and the
  chevron, placed directly before Ledger. Shown to every viewer.
- `table-view.tsx`: `const [partyOpen, setPartyOpen] = useState(false)`; `partyRows(projected,
  source.presence)` in a `useMemo`; a `<Panel open={partyOpen} onOpenChange={setPartyOpen}
  title="Party" description="Each party character, who controls it, and its vitals."
  id={PARTY_PANEL_ID}>` holding `<PartyPanel rows={…} order={model.mode.mode === "turn" ?
  model.mode.order : []} />`, placed before the Ledger panel.
- `routes/play.tsx` and `routes/play-fixture.tsx` are not edited.

### D9 — Evidence (merge condition, SC-003)

`specs/072-party-slideout/evidence/shoot.mjs`, Node built-ins only. Inputs: the worktree `.env`
(`APP_PORT`) and a creds file under the gitignored `.handoff/` (`{ "username", "password" }`).

1. On the worktree stack (`pnpm env:up`, both databases migrated, app restarted), create a
   local-stack-only operator: `OPERATOR_USERNAME=evidence-op OPERATOR_PASSWORD=<random>
   pnpm -C apps/server auth:create-operator`. Generate the password with
   `node -e "console.log(require('crypto').randomBytes(18).toString('base64url'))"` and write it
   only to `.handoff/072-operator.json`. Never print it.
2. `POST /auth/sign-in` with `fetch`; keep the `Set-Cookie` session value in memory.
3. Launch `/Applications/Brave Browser.app/Contents/MacOS/Brave Browser --headless=new
   --remote-debugging-port=<free port> --user-data-dir=<tmp dir>`; connect with `WebSocket`.
4. For each width in 1280 and 390 and each theme in light and dark: set the session cookie and
   `stacks-theme=<theme>`; set the viewport (390 with `mobile: true`); open
   `/play/fixtures/turn-mode-combat?as=00000000-0000-4000-8000-000000000001&through=<seq>`, where
   `<seq>` is the last seq before the `encounter.ended` batch (Ana's view, mid-combat); click the
   Party trigger; wait for `#party-panel`; capture
   `evidence/shots/party-<width>-<theme>.png`.
5. Print one PASS/FAIL line per check: panel open, `[aria-label="Initiative"]` present with an
   `aria-current="step"` entry, a "Your character" badge, an "AI companion" label, no `<dialog>`.
6. Kill Brave and remove the temp profile.

`evidence/README.md` records the date, the commit, the command and the PASS lines.

## Contracts (additive amendments)

- `specs/031-dm-runtime/contracts/scene-seed.md`: append "Amended by spec 072 (TASK-0164)":
  `identity.class` (1..40 chars) and `identity.level` (1..20), required.
- `specs/028-session-model/contracts/session-events.md`, Party section: append "Amended by spec 072
  (TASK-0164)": `PartyMemberSchema` gains optional `class` and `level`; the payload stays v1.
- `specs/030-play-route/contracts/ui-surfaces.md`: add the Party trigger and panel to Components
  and Accessible names ("Party", "Initiative", "Your character", "AI companion"). Not a frozen
  file.
- Not edited: `specs/029-proposal-gate/contracts/*`, `specs/030-play-route/contracts/proposal-seam.md`,
  `docs/wiki/ws-protocol.md` (OQ-1 (a)).

## Tests

- `apps/server/test/dm/seed.test.ts`: a character without `class` fails with an issue naming
  `class`; without `level`, naming `level`; level 0 and 21 fail. Every `listSeeds()` seed has a
  non-empty class and a level on every character.
- `packages/session-model/test/catalog.test.ts`: a `party.member.changed` row without class and
  level decodes `known`; one with them decodes `known` and keeps them; `level: 0` is `invalid`.
- `packages/session-model/test/fixtures.test.ts`: the turn-mode-combat party carries Ana's and
  Bram's class and level.
- `apps/server/test/dm/resolve.integration.test.ts` (DB): the scene-start test asserts Odo's party
  member has `class: "Cleric"`, `level: 1`.
- `apps/web/test/play/party.test.mjs` (new): each FR-008 label; `isOwn` for a player viewer only,
  both rows when one user controls two; DM and spectator mark none; missing class gives
  `classLevel: null`; no combatant gives null `hp` and `ac`; party order kept.
- `apps/web/test/play/party-panel.test.tsx` (new): empty text; the badge, the AI label, the HP and
  AC line, temp HP; the Initiative list only with a non-empty order.
- `apps/web/test/play/table-view.test.tsx`: the Party trigger renders for a DM, a player and a
  spectator, with `aria-controls="party-panel"`; the turn-order strip test still finds
  `aria-label="Turn order"`.
- `apps/web/test/play/turn-order.test.tsx`: the `label` prop sets the `aria-label`.
- `apps/web/test/no-dialog.test.mjs`: unchanged and green.

## Files

| File | Change |
|------|--------|
| `apps/server/src/dm/seed/schema.ts` | D1: `identity.class`, `identity.level` |
| `apps/server/seeds/greyhollow-ford.json` | D1: class and level per character |
| `apps/server/seeds/greyhollow-ford-duo.json` | D1 |
| `apps/server/seeds/greyhollow-ford-trio.json` | D1 |
| `specs/031-dm-runtime/data/greyhollow-ford.seed.json` | D1: byte copy of the shipped seed |
| `packages/session-model/src/events/party.ts` | D2: optional `class`, `level` |
| `apps/server/src/dm/nodes/resolve.ts` | D3: two fields in `directorOpening`'s party `after` |
| `packages/session-model/src/fixtures/turn-mode-combat.ts` | D4 |
| `apps/web/app/play/party.ts` (new) | D5 |
| `apps/web/app/play/components/party-panel.tsx` (new) | D6 |
| `apps/web/app/play/components/turn-order.tsx` | D7: `label` prop |
| `apps/web/app/play/components/table-header.tsx` | D8: Party trigger |
| `apps/web/app/play/table-view.tsx` | D8: state, rows, Panel |
| `specs/072-party-slideout/evidence/shoot.mjs`, `README.md`, `shots/*.png` (new) | D9 |
| 3 contract files above | amendments |
| tests listed above | extended or new |

**Migrations**: none. **New runtime dependencies**: none.

## Overlap

- **Spec 068 (TASK-0194, lane A2): yes, one shared source file, `apps/server/src/dm/nodes/resolve.ts`.**
  This plan adds two properties to the `director:party:<id>` submission in `directorOpening`
  (D3). Spec 068 D3 adds `pullIn` and calls it from `resolveAction` and the NPC group. The hunks
  are disjoint, but the runbook rule treats any shared file as a draft-hold: implement after 0194
  merges, or the orchestrator rules the disjoint hunk acceptable. Phase 1 can run first and hold
  its `resolve.ts` edit as its last task, so only that one task waits.
- **Not touched**: `dm/gates/plan-gate.ts`, `dm/snapshot/` (R4), `dm/nodes/schemas.ts`,
  `dm/prompts/`. Shared wiki notes with 068: `dm-runtime.md`, `dm-turn-jobs.md` (both cite
  `resolve.ts`); the later merge reconciles them.
- **TASK-0191 (lane A4, merged)**: this plan edits `table-view.tsx` and `table-header.tsx` but not
  the route files that hold the height bound.
- **TASK-0195**: its scenario seed is authored after this merges and must carry class and level
  (runbook "Seeds").
- **TASK-0175 (lane A5)**: no shared source file known.

## Open questions

OQ-1 and OQ-2 are in spec.md with recommended defaults (a). This plan implements the defaults.
No new question.
