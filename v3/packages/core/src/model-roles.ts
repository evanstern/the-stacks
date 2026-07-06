/**
 * Model-role resolution — env-first, fail-fast (FR-013, decision D14).
 *
 * Doctrine: no model identifier is ever hardcoded in product code (Principle
 * VII; enforced by scripts/check-boundaries.mjs rule 3). Code asks for a
 * *role* ("embedding"), and the concrete provider/endpoint/model/dimensions
 * come from the environment at boot. Missing or malformed env throws
 * immediately, naming the exact variable, so a misconfigured deploy dies at
 * startup instead of failing mid-request. See specs/007-v3-skeleton/research.md.
 *
 * The dimensions value resolved here is what stamps every skeleton_vectors row
 * (FR-014) and feeds the deterministic vector id (skeleton-check.ts).
 */

// Closed union of roles; grows as new roles (chat, rerank, ...) get specs.
export type ModelRoleName = "embedding";

export interface ModelRoleConfig {
  role: ModelRoleName;
  provider: string;
  endpoint: string;
  modelId: string;
  dimensions: number;
}

// Fail-fast helpers: the error message must name the variable (D14) so an
// operator can fix the deploy without reading source. Empty string counts as
// missing — compose files and CI templates often leave vars set-but-blank.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function requireEnvInt(name: string): number {
  const raw = requireEnv(name);
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || Number.isNaN(value)) {
    throw new Error(`Environment variable ${name} must be an integer, got: ${raw}`);
  }
  return value;
}

// Called once at process boot (api/worker), not per-request: config is a
// startup concern, and a role change requires a restart by design.
export function resolveModelRole(role: ModelRoleName): ModelRoleConfig {
  switch (role) {
    case "embedding":
      return {
        role: "embedding",
        provider: requireEnv("EMBEDDING_PROVIDER"),
        endpoint: requireEnv("EMBEDDING_ENDPOINT"),
        modelId: requireEnv("EMBEDDING_MODEL_ID"),
        dimensions: requireEnvInt("EMBEDDING_DIMENSIONS"),
      };
    default: {
      // Exhaustiveness guard: adding a ModelRoleName without a case here is a
      // compile error, so new roles can't silently resolve to nothing.
      const exhaustive: never = role;
      throw new Error(`Unknown model role: ${exhaustive}`);
    }
  }
}
