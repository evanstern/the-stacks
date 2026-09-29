// scripts/deploy-lib.mjs — pure derivation functions behind the hosted `dev`
// deploy/rollback/drift verbs (spec 016). No fs/child_process/network here:
// everything a caller needs from git/docker/http is gathered by
// scripts/deploy-dev.mjs and passed in as plain data, so this file runs
// (and is tested) without Docker or vm-104.
//
// See specs/016-hosted-dev-cd/research.md R2 (stale-commit skip), R6 (verify
// and image tags), R7 (drift grace window), R8 (this file's own scope).
import { mergeEnvFile } from "./env-lib.mjs";

/**
 * Whether a push-triggered deploy should run or be skipped as stale
 * (research R2). An operator-named commit (`allowStale`) always deploys.
 */
export function deployDecision({ sha, mainHead, allowStale }) {
  if (sha !== mainHead && !allowStale) return "skip";
  return "deploy";
}

/** True only when `/health` reports both success and the deployed commit. */
export function healthMatches(body, sha) {
  return Boolean(body) && body.status === "ok" && body.commit === sha;
}

/**
 * Compare `dev`'s reported commit to `main` HEAD (research R7). Unreachable
 * `dev` (`observed === null`) is always `"drift"`, never `"pending"` — an
 * unanswering host is not "maybe mid-deploy", it's down.
 */
export function driftVerdict({
  expected,
  observed,
  expectedAgeMin,
  graceMin = 30,
}) {
  if (observed === null) return "drift";
  if (observed === expected) return "ok";
  return expectedAgeMin < graceMin ? "pending" : "drift";
}

/**
 * Which `repository:tag` entries a prune should remove: everything but the
 * newest `keep` (by creation time) within each repository. `images` is the
 * array `docker image ls --format json` produces (fields `Repository`,
 * `Tag`, `CreatedAt`).
 */
export function tagsToPrune(images, keep = 3) {
  const byRepo = new Map();
  for (const image of images) {
    const list = byRepo.get(image.Repository) ?? [];
    list.push(image);
    byRepo.set(image.Repository, list);
  }
  const toRemove = [];
  for (const list of byRepo.values()) {
    const sorted = [...list].sort(
      (a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt),
    );
    for (const image of sorted.slice(keep)) {
      toRemove.push(`${image.Repository}:${image.Tag}`);
    }
  }
  return toRemove;
}

/**
 * Render the `dev` secrets file (research R4): `.env.example` with the
 * fixed dev ports/env and a generated Postgres password, plus a matching
 * `DATABASE_URL`. Reuses `mergeEnvFile`'s example-driven merge.
 */
export function renderDevEnv(exampleText, password) {
  return mergeEnvFile(exampleText, "", {
    APP_PORT: "3000",
    DB_PORT: "5432",
    STACKS_ENV: "dev",
    POSTGRES_PASSWORD: password,
    DATABASE_URL: `postgres://stacks:${password}@db:5432/stacks`,
  });
}
