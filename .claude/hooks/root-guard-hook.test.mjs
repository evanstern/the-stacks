// root-guard-hook.test.mjs — stdlib-only regression tests for the root-guard
// hook's board-sync path classifier (spec 008). Run with:
//   node --test .claude/hooks/
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyBoardSyncCommit, boardPathspecOk } from './root-guard-hook.mjs';

const HOOK_PATH = fileURLToPath(new URL('./root-guard-hook.mjs', import.meta.url));

// Build a throwaway git repo under os.tmpdir() with one initial commit.
// Returns its realpath (so string comparisons against realpath-resolved
// values inside the hook line up on platforms with symlinked temp dirs).
function makeRepo(t) {
  const dir = mkdtempSync(join(tmpdir(), 'root-guard-test-'));
  execFileSync('git', ['-C', dir, 'init', '-q']);
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'Test User']);
  execFileSync('git', ['-C', dir, 'config', 'user.email', 'test@example.com']);
  writeFileSync(join(dir, 'README.md'), 'init\n');
  execFileSync('git', ['-C', dir, 'add', '--', 'README.md']);
  execFileSync('git', ['-C', dir, 'commit', '-q', '-m', 'initial commit']);
  const real = realpathSync(dir);
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return real;
}

// Write relPath (creating parent dirs) and `git add` it via an argument
// array — never a shell string — so the path reaches git verbatim.
function stage(repo, relPath, content = 'x\n') {
  const full = join(repo, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
  execFileSync('git', ['-C', repo, 'add', '--', relPath]);
}

describe('classifyBoardSyncCommit — baseline (Phase 1)', () => {
  test('ASCII backlog/ file staged is allowed', (t) => {
    const repo = makeRepo(t);
    stage(repo, 'backlog/tasks/a.md');
    assert.deepEqual(classifyBoardSyncCommit(['-m', 'x'], repo, repo), { ok: true });
  });

  test('ASCII non-backlog file staged is refused', (t) => {
    const repo = makeRepo(t);
    stage(repo, 'docs/a.md');
    assert.deepEqual(classifyBoardSyncCommit(['-m', 'x'], repo, repo), {
      ok: false,
      reason: 'staged-outside',
      token: 'docs/a.md',
    });
  });
});
