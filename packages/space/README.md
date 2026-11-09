# @the-stacks/space

Zone graph geometry for a scene: zones, edges, range bands, cheapest paths, and the reach and
range rules. Pure. No renderer, React, clock, I/O, engine or model. Runtime dependency: `zod` only.

## Exports

- Schemas: `SpaceSchema`, `ZoneSchema`, `EdgeSchema`, `ZoneIdSchema`, `PlacementSchema`, `BandSchema`.
- Graph: `path(space, from, to)`, `band(space, a, b)`, `BAND_FEET`.
- Rules: `reachCovers(band, reachFt)`, `rangeOf(band, {normal, long})`.
- View: `SpaceView`, `zoneOf`, `occupants`, `bandBetween`.

## Band convention (zone mode)

One convention, no grid. Distance between two placements is a band:

| Band | Meaning | Nominal feet |
|---|---|---|
| `engaged` | same zone | 5 |
| `near` | one passable edge apart | 30 |
| `far` | two passable edges apart | 120 |
| `out` | more, or no passable path | none |

- `band()` counts edges on the fewest-edge passable path. Edge `feet` never change a band.
- Edge `feet` drive movement cost only (`path()` minimises feet).
- Melee reach covers `engaged` only (SRD 5.2.1 "Melee Attacks"). Ranged: within normal range is
  plain, within long range is Disadvantage, beyond is out of range (SRD 5.2.1 "Ranged Attacks").

## Edge cost convention

- `open` and `door` cost 1 ft per foot. A door is passable. A locked door is a `blocked` edge.
- `squeeze` and `climb` cost 2 ft per foot (SRD 5.2.1 "Climbing", "Squeezing").
- `blocked` is never passable.
- Equal-cost paths tie-break by the lexicographic order of the zone id list.

## Versioning

Additive changes only (optional fields, new edge kinds). A grid mode (R5) adds an optional square to
`Placement`.
