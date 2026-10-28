# Data model: Two-player alpha kit

No new table, column, event type or migration.

## Scene seed (existing schema, one rule changed)

`SceneSeedSchema` (`apps/server/src/dm/seed/schema.ts`) is unchanged. Each character has
`seat: "human" | "companion"`.

Cross-check change in `crossCheckSeed`:

| Rule | Before | After |
|------|--------|-------|
| Human seats | exactly one | at least one; no maximum |

### `greyhollow-ford-duo` (new file)

A copy of `greyhollow-ford.json` with these differences:

| Field | Value |
|-------|-------|
| `seedId` | `greyhollow-ford-duo` |
| `title` | `Greyhollow Ford (two players)` |
| `characters[tamsin].seat` | `human` (unchanged) |
| `characters[kestrel].seat` | `human` (was `companion`) |
| `characters[odo].seat` | `companion` (unchanged) |
| `characters[kestrel].portrayal.voice` and `.want` | `Chosen by the player.` (as tamsin's) |

Beats, NPCs, encounters, trackers, opening and license stay as in greyhollow-ford. Kestrel's
identity and hooks stay, so the seed passes the content contract.

## Seat map (start request, existing shape, one rule added)

`seats: Record<characterId, userId>`.

| Rule | Status |
|------|--------|
| Every human character has a seat | existing |
| Every key is a human character | existing |
| No user id appears twice | **new** (contracts/scene-start-seats.md) |

## Seed summary (new response shape)

Returned by `GET /dm/seeds` (contracts/dm-seeds.md).

| Field | Type | Source |
|-------|------|--------|
| `seedId` | string | `seed.seedId` |
| `title` | string | `seed.title` |
| `humans` | `{ characterId, name }[]` | characters with `seat: "human"`, seed order |
| `companions` | `{ characterId, name }[]` | characters with `seat: "companion"`, seed order |

## Invitation (existing, unchanged)

Single-use, 7-day default expiry, token returned once, only its hash stored. Redeem creates a
`player` account and signs it in (`specs/005-session-auth/contracts/http-auth.md`).
