// env-orphan-hook.test.mjs — stdlib-only tests for the orphan Stop hook
// (spec 010 T013): warn-only on an orphan, silent otherwise, and proof that
// adding the Stop entry left the root-guard PreToolUse entries untouched.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { warningFor } from "./env-orphan-hook.mjs";

test("warns and names the orphans on exit 1", () => {
  const warning = warningFor({
    status: 1,
    stdout: "orphan: stacks-task-0099 (worktree /repo/.worktrees/task-0099 gone)\n",
  });
  assert.match(warning, /stacks-task-0099/);
});

test("silent on exit 2 (Docker unreachable)", () => {
  assert.equal(warningFor({ status: 2, stdout: "" }), null);
});

test("silent on exit 0 (no orphans)", () => {
  assert.equal(warningFor({ status: 0, stdout: "no orphans.\n" }), null);
});

test("settings.json PreToolUse root-guard entries are byte-identical to the pre-Stop-hook value", () => {
  const settings = JSON.parse(
    readFileSync(new URL("../settings.json", import.meta.url), "utf8"),
  );
  assert.deepEqual(settings.hooks.PreToolUse, [
    {
      matcher: "Bash",
      hooks: [
        {
          type: "command",
          command:
            'node "$CLAUDE_PROJECT_DIR/.claude/hooks/root-guard-hook.mjs" pre-bash',
        },
      ],
    },
    {
      matcher: "Write|Edit|NotebookEdit",
      hooks: [
        {
          type: "command",
          command:
            'node "$CLAUDE_PROJECT_DIR/.claude/hooks/root-guard-hook.mjs" pre-write',
        },
      ],
    },
  ]);
});
