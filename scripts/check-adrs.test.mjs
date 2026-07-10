/**
 * The ADR gate's pure core (check-adrs.mjs). Runs under `node --test scripts/`
 * inside `pnpm verify`.
 *
 * What must hold:
 *  - the founding ADR's exact format validates clean (H1, Status/Date/
 *    Decision-maker bullets, Decision/Context/Consequences sections)
 *  - each structural omission is named individually
 *  - duplicate numbers FAIL, gaps only WARN (ADRs are never renumbered)
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { validateAdr, validateNumbering } from "./check-adrs.mjs";

const GOOD = `# ADR 0002: Adopt the process architecture

- **Status**: accepted
- **Date**: 2026-07-10
- **Decision maker**: operator

## Decision

We adopt it.

## Context

There was none.

## Consequences

There are many.
`;

test("a well-formed ADR validates clean", () => {
  assert.deepEqual(validateAdr("0002-adopt-the-process-architecture.md", GOOD).errors, []);
});

test("bad filename is the only error reported (nothing else is checkable)", () => {
  const { errors } = validateAdr("2-bad-name.md", GOOD);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /NNNN-kebab-slug\.md/);
});

test("H1 number must match the filename", () => {
  const { errors } = validateAdr("0003-mismatch.md", GOOD);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /H1 says ADR 0002 but the filename says 0003/);
});

test("each missing piece is named individually", () => {
  const { errors } = validateAdr("0002-x.md", "# ADR 0002: bare\n");
  const joined = errors.join("\n");
  assert.match(joined, /Status/);
  assert.match(joined, /Date/);
  assert.match(joined, /Decision maker/);
  assert.match(joined, /## Decision/);
  assert.match(joined, /## Context/);
  assert.match(joined, /## Consequences/);
});

test("unknown Status value fails", () => {
  const { errors } = validateAdr("0002-x.md", GOOD.replace("accepted", "maybe"));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /"maybe" is not one of/);
});

test("duplicate numbers fail; gaps only warn", () => {
  const dup = validateNumbering(["0001-a.md", "0001-b.md"]);
  assert.equal(dup.errors.length, 1);
  assert.match(dup.errors[0], /more than one ADR/);

  const gap = validateNumbering(["0001-a.md", "0003-c.md"]);
  assert.deepEqual(gap.errors, []);
  assert.equal(gap.warnings.length, 1);
  assert.match(gap.warnings[0], /gap/);

  assert.deepEqual(validateNumbering(["0001-a.md", "0002-b.md"]), { errors: [], warnings: [] });
});
