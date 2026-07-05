export type ModelRoleName = "embedding";

export interface ModelRoleConfig {
  role: ModelRoleName;
  provider: string;
  endpoint: string;
  modelId: string;
  dimensions: number;
}

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
      const exhaustive: never = role;
      throw new Error(`Unknown model role: ${exhaustive}`);
    }
  }
}
