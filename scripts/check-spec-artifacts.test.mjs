/**
 * The spec-artifacts gate's pure core (check-spec-artifacts.mjs). Runs under
 * `node --test scripts/` inside `pnpm verify`.
 *
 * What must hold:
 *  - the checkbox parser counts exactly what spec-bridge's derivation counts
 *    (one definition of "complete" for this gate and the board)
 *  - closure (evidence + course) is owed ONLY when tasks.md exists, has at
 *    least one checkbox, and every box is checked — an open cycle owes nothing
 *  - a spec dir without spec.md fails regardless of anything else
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { evaluateSpec, parseCheckboxes } from "./check-spec-artifacts.mjs";

const TASKS_OPEN = `## Phase 1: Setup
- [x] T001 do a thing
- [ ] T002 do another thing
`;
const TASKS_DONE = `## Phase 1: Setup
- [x] T001 do a thing
- [X] T002 do another thing

## Phase 2: Convergence
* [x] T003 converge
`;
const TASKS_EMPTY = `# Tasks

No checkboxes yet — phases land after /speckit-tasks runs.
- this dash line has no checkbox
`;

test("parseCheckboxes matches spec-bridge's shape: -/* bullets, [ ]/[x]/[X], content required", () => {
  assert.deepEqual(parseCheckboxes(TASKS_OPEN), { done: 1, total: 2 });
  assert.deepEqual(parseCheckboxes(TASKS_DONE), { done: 3, total: 3 });
  assert.deepEqual(parseCheckboxes(TASKS_EMPTY), { done: 0, total: 0 });
  // "[x]" with no task text after it is noise, not a task
  assert.deepEqual(parseCheckboxes("- [x]\n- [x] real"), { done: 1, total: 1 });
});

test("missing spec.md fails even with no tasks", () => {
  const errors = evaluateSpec({ name: "010-x", hasSpec: false, tasksText: null, hasEvidence: false, hasCourse: false });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /spec\.md missing/);
});

test("open cycle owes no closure", () => {
  assert.deepEqual(
    evaluateSpec({ name: "010-x", hasSpec: true, tasksText: TASKS_OPEN, hasEvidence: false, hasCourse: false }),
    [],
  );
});

test("tasks.md with zero checkboxes claims nothing", () => {
  assert.deepEqual(
    evaluateSpec({ name: "010-x", hasSpec: true, tasksText: TASKS_EMPTY, hasEvidence: false, hasCourse: false }),
    [],
  );
});

test("complete cycle without evidence and course fails both ways, naming Principle VIII", () => {
  const errors = evaluateSpec({ name: "010-x", hasSpec: true, tasksText: TASKS_DONE, hasEvidence: false, hasCourse: false });
  assert.equal(errors.length, 2);
  assert.match(errors[0], /evidence\.md missing/);
  assert.match(errors[1], /Principle VIII/);
  assert.match(errors[1], /docs\/courses\/010-x\/index\.html/);
});

test("complete cycle with evidence + course passes", () => {
  assert.deepEqual(
    evaluateSpec({ name: "010-x", hasSpec: true, tasksText: TASKS_DONE, hasEvidence: true, hasCourse: true }),
    [],
  );
});
