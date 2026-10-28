# Contract: GET /dm/seeds

New operator route (Q5, ruled 2026-10-28). Mounted under `/dm` beside the routes in
`specs/031-dm-runtime/contracts/dm-api.md`, which gains a matching section.

## Request

`GET /dm/seeds`. No query, no body. Session cookie required.

## Responses

- `200`:
  ```json
  {
    "seeds": [
      {
        "seedId": "greyhollow-ford",
        "title": "…",
        "humans": [{ "characterId": "tamsin", "name": "Tamsin Vale" }],
        "companions": [
          { "characterId": "odo", "name": "Brother Odo" },
          { "characterId": "kestrel", "name": "Kestrel" }
        ]
      }
    ]
  }
  ```
  Sorted by `seedId`. `humans` and `companions` keep seed order.
- `401 unauthorized`: no valid session.
- `403 forbidden`: the caller is not the operator.

## Rules

- Lists every `*.json` file in the seed directory that loads through `loadSeed`.
- A file that fails to load is left out of `seeds` and logged once per request as
  `{ "event": "dm.seeds.load-failed", "seedId", "issues" }`. The route still returns 200.
- Returns no other seed field. No DM-only text (`dmOnlySeedPaths`) can appear.
- Read-only. Writes nothing.
