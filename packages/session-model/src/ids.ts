import { z } from "zod";

/** Ids for actions, batches, characters, scenes, journal entries and trackers. */
export const RefIdSchema = z.string().regex(/^[a-z0-9][a-z0-9_.:-]{0,63}$/);

/**
 * Combatant ids. The regex is copied by value from the engine's CombatantIdSchema
 * (specs/026-dnd5e-engine/contracts/engine-api.md); the engine does not export it.
 */
export const CombatantIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9_.:-]{0,63}$/);

/**
 * A human actor is the user id the server records. Reserved actors: "ai:dm",
 * "ai:companion:<characterId>" and "system".
 */
export const ActorIdSchema = z.string().min(1).max(128);

/** "public", "dm", or one user id (a whisper). */
export const VisibilitySchema = z.string().min(1).max(128);
export const PUBLIC = "public";
export const DM_ONLY = "dm";

/** Same bounds as the engine's Reason. */
export const ReasonSchema = z.string().min(1).max(500);
