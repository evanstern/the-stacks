/**
 * Gateway purposes for the DM runtime (specs/031-dm-runtime contracts/
 * purposes.md). Names are code constants; model choice per purpose stays in
 * `AI_PURPOSES` (decision-0007: no vendor name in source). Every purpose is
 * `op: "chat"`.
 */
export const DM_PURPOSES = [
  "dm.director",
  "dm.interpret",
  "dm.adjudicate",
  "dm.narrate",
  "dm.audit",
  "dm.chronicle",
  "dm.companion",
] as const;
export type DmPurpose = (typeof DM_PURPOSES)[number];

/** The one purpose each caller may name (AC #4, FR-021). */
export const PURPOSE_OF = {
  director: "dm.director",
  interpret: "dm.interpret",
  adjudicate: "dm.adjudicate",
  narrate: "dm.narrate",
  audit: "dm.audit",
  chronicle: "dm.chronicle",
  companion: "dm.companion",
} as const;

/**
 * Output caps per purpose (`maxTokens`). Hidden thinking on routed models counts against the
 * cap, so each is 4000 (1200 truncated interpret in alpha run 3). Matches `.env.example`.
 */
export const PURPOSE_MAX_TOKENS: Record<DmPurpose, number> = {
  "dm.director": 4000,
  "dm.interpret": 4000,
  "dm.adjudicate": 4000,
  "dm.narrate": 4000,
  "dm.audit": 4000,
  "dm.chronicle": 4000,
  "dm.companion": 4000,
};

/** The `dm.*` purposes absent from an `AiConfig.purposes` map (log by name at boot). */
export function missingDmPurposes(
  purposes: Record<string, unknown>,
): DmPurpose[] {
  return DM_PURPOSES.filter((p) => !(p in purposes));
}
