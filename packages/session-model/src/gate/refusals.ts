import { z } from "zod";

export type GateRefusalSource = "gate" | "engine" | "append";

export const GateRefusalCodeSchema = z.enum([
  "INVALID_PROPOSAL",
  "NOT_AUTHORIZED",
  "NOT_DM",
  "UNKNOWN_ACTION",
  "ACTION_EXISTS",
  "ACTION_NOT_OPEN",
  "ACTION_NOT_COMMITTED",
  "COMMIT_NOT_ALLOWED",
  "GROUP_SIGNOFF_REQUIRED",
  "UNKNOWN_BATCH",
  "JOURNAL_ENTRY_EXISTS",
  "UNKNOWN_PROPOSAL",
  "PROPOSAL_NOT_PENDING",
  "PROPOSAL_NOT_APPROVABLE",
  "CONFLICT",
]);
export type GateRefusalCode = z.infer<typeof GateRefusalCodeSchema>;

export interface GateRefusal {
  source: GateRefusalSource;
  /** A GateRefusalCode, an engine RefusalCode, or an AppendRefusalCode. */
  code: string;
  /** For humans and logs; never parsed. */
  message: string;
  details?: Record<string, unknown>;
}
