/**
 * Worktree-environment derivation — the pure math behind mint-worktree-env.mjs
 * (009 US2; contracts/environment.md §2–§4). Kept CLI-free so the protocol's
 * guarantees are unit-testable (worktree-env-lib.test.mjs, wired into
 * `pnpm verify`): determinism here is what lets the repo skip a port registry.
 *
 * The rule in one line: a worktree's identity and ports derive from its
 * DIRNAME alone — `NNN-slug` gets default + 10×NNN and the-stacks-NNN-slug;
 * `main` is the fixed point (offset 0, the-stacks-v3). Feature numbers are
 * unique by spec-kit construction, so derived blocks can't collide;
 * findPortCollisions() merely VERIFIES that inheritance against reality
 * (manual overrides are where mistakes live — see §3's web-on-4500 tale).
 */

/** Default published ports — mirrors .env.example, the variable contract. */
export const DEFAULT_PORTS = Object.freeze({ web: 4400, api: 4401, ml: 4402, postgres: 5442 });

const PORT_KEYS = Object.freeze({
  V3_WEB_PORT: "web",
  V3_API_PORT: "api",
  V3_ML_PORT: "ml",
  V3_POSTGRES_PORT: "postgres",
});

const BLOCK_STRIDE = 10;

/** @param {string} dirname worktree directory name (basename, not a path) */
export function deriveProfile(dirname) {
  if (dirname === "main") {
    // main/ predates the protocol and its compose identity is load-bearing
    // (container/volume names depend on it) — it stays the-stacks-v3 forever.
    return { dirname, projectName: "the-stacks-v3", offset: 0, ports: { ...DEFAULT_PORTS } };
  }
  const match = /^(\d+)-/.exec(dirname);
  if (!match) {
    throw new Error(
      `Cannot derive an environment for "${dirname}": no leading feature number ` +
        `(expected NNN-slug, e.g. 009-library-surface-env). Deterministic derivation ` +
        `is the whole protocol — name the worktree after its feature branch.`,
    );
  }
  const featureNumber = Number.parseInt(match[1], 10);
  const offset = BLOCK_STRIDE * featureNumber;
  return {
    dirname,
    projectName: `the-stacks-${dirname}`,
    offset,
    ports: {
      web: DEFAULT_PORTS.web + offset,
      api: DEFAULT_PORTS.api + offset,
      ml: DEFAULT_PORTS.ml + offset,
      postgres: DEFAULT_PORTS.postgres + offset,
    },
  };
}

/** Minimal .env parser — KEY=value lines, comments/blanks skipped. Values are
 * kept verbatim (no unquoting/expansion: compose does its own interpolation,
 * and round-tripping bytes untouched is what keeps escaped bcrypt hashes safe). */
export function parseEnv(content) {
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return env;
}

/**
 * Render a worktree's .env from the template (.env.example), the derived
 * profile, and operator-supplied secrets. Everything the protocol does not
 * derive passes through untouched — the template stays the variable contract.
 *
 * Secrets are copied or left blank, NEVER generated: inventing an operator
 * password silently would hide the one thing the operator must own.
 */
export function mintEnv(template, dirname, secrets = {}) {
  const profile = deriveProfile(dirname);
  const replacements = {
    COMPOSE_PROJECT_NAME: profile.projectName,
    V3_WEB_PORT: String(profile.ports.web),
    V3_API_PORT: String(profile.ports.api),
    V3_ML_PORT: String(profile.ports.ml),
    V3_POSTGRES_PORT: String(profile.ports.postgres),
    // The port-coupled derivation (§4): the api container binds V3_API_PORT
    // INSIDE the container, so the in-network URL must move with it.
    API_INTERNAL_URL: `http://api:${profile.ports.api}`,
    ...(secrets.OPERATOR_PASSWORD_HASH !== undefined
      ? { OPERATOR_PASSWORD_HASH: secrets.OPERATOR_PASSWORD_HASH }
      : {}),
    ...(secrets.SESSION_SECRET !== undefined ? { SESSION_SECRET: secrets.SESSION_SECRET } : {}),
  };

  return template
    .split("\n")
    .map((line) => {
      const eq = line.indexOf("=");
      if (eq === -1 || line.trimStart().startsWith("#")) return line;
      const key = line.slice(0, eq);
      return key in replacements ? `${key}=${replacements[key]}` : line;
    })
    .join("\n");
}

/**
 * Compare a worktree profile's ports against sibling worktrees' parsed .env
 * files. Returns [{dirname, port}] for every intersection — the mint-time
 * refusal that turns "runtime bind failure mid-startup" into a named error.
 */
export function findPortCollisions(profile, siblings) {
  const mine = new Set(Object.values(profile.ports));
  const collisions = [];
  for (const sibling of siblings) {
    for (const key of Object.keys(PORT_KEYS)) {
      const value = Number.parseInt(sibling.env[key] ?? "", 10);
      if (!Number.isNaN(value) && mine.has(value)) {
        collisions.push({ dirname: sibling.dirname, port: value });
      }
    }
  }
  return collisions;
}

/**
 * Drift report (§1, FR-016): after .env.example changes, does this .env still
 * satisfy the contract? Three finding kinds, all named, none auto-repaired:
 *  - missing:   template keys absent from the .env
 *  - unknown:   .env keys the template no longer knows (retired/typo'd)
 *  - couplings: port-coupled values that stopped moving together
 */
export function checkDrift(template, envContent) {
  const templateKeys = Object.keys(parseEnv(template));
  const env = parseEnv(envContent);
  const envKeys = Object.keys(env);

  const missing = templateKeys.filter((key) => !envKeys.includes(key));
  const unknown = envKeys.filter((key) => !templateKeys.includes(key));

  const couplings = [];
  if (env.API_INTERNAL_URL !== undefined && env.V3_API_PORT !== undefined) {
    const expected = `http://api:${env.V3_API_PORT}`;
    if (env.API_INTERNAL_URL !== expected) {
      couplings.push(
        `API_INTERNAL_URL is ${env.API_INTERNAL_URL} but V3_API_PORT is ${env.V3_API_PORT} — ` +
          `expected ${expected} (the api container binds V3_API_PORT internally; ` +
          `this mismatch is the classic ECONNREFUSED-from-every-loader footgun)`,
      );
    }
  }

  return { missing, unknown, couplings };
}
