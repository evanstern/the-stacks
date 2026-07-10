#!/usr/bin/env node
// check-version-bump.mjs — enforce "released surface changed ⇒ version bumped".
//
//   node scripts/check-version-bump.mjs [--base <ref>]   # default base: origin/main
//
// The repo ships as ONE deployed stack with a single semver in the root
// package.json (constitution Development Workflow: versioning & release; the
// model is praxis's check-version-bump, adapted from marketplace.json to an
// app repo). Evaluates the COMMITTED range merge-base(<base>, HEAD)..HEAD —
// uncommitted edits don't count, a bump must ship with the commits it covers:
//
//   - If the diff touches released surface — anything a deploy or `pnpm verify`
//     actually runs: apps/, packages/, scripts/, the compose files, the root
//     manifests — the root package.json version must be a semver INCREASE over
//     the base's, and the tag v<version> must not already exist (versions are
//     never reused; release.yml tags each new version on main).
//   - Everything else (docs/, specs/, backlog/, .github/, .githooks/, .claude/,
//     .specify/, root markdown) is exempt: no bump required. Process and
//     documentation change freely; only shipped behavior versions.
//
// Like check-boundaries.mjs this is dependency-free and deliberately blunt:
// a pure evaluate() core (unit-tested in check-version-bump.test.mjs) plus a
// thin git wrapper.
import { execFileSync } from "node:child_process";

// ---------- pure core (unit-tested) ----------

export function semverParse(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v ?? "").trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

export function semverGt(a, b) {
  const pa = semverParse(a), pb = semverParse(b);
  if (!pa || !pb) return false;
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] > pb[i];
  return false;
}

/** Is this repo-relative path part of what a release ships? */
export function releasedSurface(path) {
  if (/^(apps|packages|scripts)\//.test(path)) return true;
  return [
    "docker-compose.yml",
    "docker-compose.prod.yml",
    "package.json",
    "pnpm-workspace.yaml",
    "pnpm-lock.yaml",
    "tsconfig.base.json",
    ".env.example",
  ].includes(path);
}

/**
 * Decide pass/fail from plain data. Returns human-actionable errors ([] = pass).
 *   changedFiles   repo-relative paths in the committed range
 *   baseVersion    root package.json version at the merge base (null if unreadable)
 *   headVersion    root package.json version at HEAD
 *   tagExists      does v<headVersion> already exist?
 */
export function evaluate({ changedFiles, baseVersion, headVersion, tagExists }) {
  const errors = [];
  if (!changedFiles.some(releasedSurface)) return errors;
  if (!semverParse(headVersion)) {
    errors.push(`root package.json version ${JSON.stringify(headVersion)} is not x.y.z semver`);
  } else if (baseVersion != null && !semverGt(headVersion, baseVersion)) {
    errors.push(
      `released surface changed but package.json version did not increase ` +
      `(base ${baseVersion}, head ${headVersion}) — bump it (patch: fixes; ` +
      `minor: new capability; major: breaking operator-facing contracts)`,
    );
  } else if (tagExists) {
    errors.push(`v${headVersion} is already released (tag exists) — pick a higher version`);
  }
  return errors;
}

// ---------- git wrapper ----------

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trimEnd();
}

function versionAt(ref) {
  try { return JSON.parse(git(["show", `${ref}:package.json`]))?.version ?? null; }
  catch { return null; }
}

export function main(argv = process.argv.slice(2)) {
  const i = argv.indexOf("--base");
  const baseRef = i !== -1 ? argv[i + 1] : "origin/main";

  let mergeBase;
  try { mergeBase = git(["merge-base", baseRef, "HEAD"]); }
  catch { console.error(`cannot resolve merge-base of ${baseRef} and HEAD — fetch the base ref first`); return 2; }

  const changedFiles = git(["diff", "--name-only", mergeBase, "HEAD"]).split("\n").filter(Boolean);
  if (changedFiles.length === 0) { console.log("no committed changes vs base — nothing to check"); return 0; }

  const baseVersion = versionAt(mergeBase);
  const headVersion = versionAt("HEAD");
  const errors = evaluate({
    changedFiles,
    baseVersion,
    headVersion,
    tagExists: headVersion ? git(["tag", "-l", `v${headVersion}`]) !== "" : false,
  });

  if (errors.length) {
    console.error("version-bump check failed:");
    for (const e of errors) console.error(`  - ${e}`);
    return 1;
  }
  console.log(headVersion !== baseVersion
    ? `version bump ok: ${baseVersion} → ${headVersion}`
    : "no released surface changed — no bump required");
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main());
