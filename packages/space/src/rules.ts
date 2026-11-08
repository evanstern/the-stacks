import { BAND_FEET } from "./graph.js";
import type { Band } from "./schema.js";

/** Melee reach covers only the engaged band in zone mode. */
export function reachCovers(band: Band, reachFt: number): boolean {
  return band === "engaged" && reachFt >= BAND_FEET.engaged;
}

/** Ranged use at a band: within normal, within long (disadvantage), or out. */
export function rangeOf(
  band: Band,
  range: { normal: number; long: number },
): "normal" | "long" | "out" {
  if (band === "out") return "out";
  const ft = BAND_FEET[band];
  if (ft <= range.normal) return "normal";
  if (ft <= range.long) return "long";
  return "out";
}
