# Contract: scene-start seat rules

Amends `POST /dm/sessions/:sessionId/start` (`specs/031-dm-runtime/contracts/dm-api.md`).
The body shape is unchanged: `{ seedId, seats: Record<characterId, userId> }`.

## Seat validation, in order

All three rules run together. Every issue found is returned in one `400 validation` response,
before any job is enqueued.

1. Each human character of the seed has a key in `seats`. Issue: path `seats.<id>`,
   `A human seat needs a user id.` (existing)
2. Each key in `seats` is a human character of the seed. Issue: path `seats.<id>`,
   `Not a human character in this seed.` (existing)
3. **New.** No user id holds two seats. Walk `seats` in seed character order; for each seat
   whose user id already holds an earlier seat, add an issue: path `seats.<id>`,
   `A user can hold only one seat.`

## Seed loading

`loadSeed` accepts a seed with one or more human seats and refuses a seed with none, with the
issue `at least one character must have seat "human", found 0`. A refused seed is a
`400 validation` on `seedId`, as before.
