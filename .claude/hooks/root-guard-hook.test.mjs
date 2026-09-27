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

describe('classifyBoardSyncCommit — US1 non-ASCII board commits allowed (Phase 2)', () => {
  test('a lone non-ASCII backlog/ path staged is allowed', (t) => {
    const repo = makeRepo(t);
    stage(repo, 'backlog/milestones/m-0 - m0-—-skeleton.md');
    assert.deepEqual(classifyBoardSyncCommit(['-m', 'x'], repo, repo), { ok: true });
  });

  test('a non-ASCII backlog/ path plus an ASCII backlog/ path is allowed', (t) => {
    const repo = makeRepo(t);
    stage(repo, 'backlog/milestones/m-0 - m0-—-skeleton.md');
    stage(repo, 'backlog/tasks/a.md');
    assert.deepEqual(classifyBoardSyncCommit(['-m', 'x'], repo, repo), { ok: true });
  });
});

describe('classifyBoardSyncCommit — US2 non-board paths stay blocked (Phase 3)', () => {
  test('non-ASCII outside-backlog path is refused, named verbatim, alongside a backlog file', (t) => {
    const repo = makeRepo(t);
    stage(repo, 'docs/café.md');
    stage(repo, 'backlog/tasks/a.md');
    assert.deepEqual(classifyBoardSyncCommit(['-m', 'x'], repo, repo), {
      ok: false,
      reason: 'staged-outside',
      token: 'docs/café.md',
    });
  });

  test('a path that only looks like it starts with backlog/ is refused', (t) => {
    const repo = makeRepo(t);
    stage(repo, 'backlog—x/a.md');
    assert.deepEqual(classifyBoardSyncCommit(['-m', 'x'], repo, repo), {
      ok: false,
      reason: 'staged-outside',
      token: 'backlog—x/a.md',
    });
  });

  test('a literal newline in a backlog/ file name is still allowed', (t) => {
    const repo = makeRepo(t);
    stage(repo, 'backlog/a\nb.md');
    assert.deepEqual(classifyBoardSyncCommit(['-m', 'x'], repo, repo), { ok: true });
  });

  test('a literal newline in a non-backlog file name is refused with the full name as token', (t) => {
    const repo = makeRepo(t);
    stage(repo, 'docs/a\nb.md');
    assert.deepEqual(classifyBoardSyncCommit(['-m', 'x'], repo, repo), {
      ok: false,
      reason: 'staged-outside',
      token: 'docs/a\nb.md',
    });
  });

  test('a double quote in a backlog/ file name is allowed', (t) => {
    const repo = makeRepo(t);
    stage(repo, 'backlog/a"b.md');
    assert.deepEqual(classifyBoardSyncCommit(['-m', 'x'], repo, repo), { ok: true });
  });

  test('nothing staged is refused as nothing-staged', (t) => {
    const repo = makeRepo(t);
    assert.deepEqual(classifyBoardSyncCommit(['-m', 'x'], repo, repo), {
      ok: false,
      reason: 'nothing-staged',
    });
  });

  test('core.quotepath=false locally does not change the verdict', (t) => {
    const repo = makeRepo(t);
    execFileSync('git', ['-C', repo, 'config', 'core.quotepath', 'false']);
    stage(repo, 'docs/café.md');
    stage(repo, 'backlog/tasks/a.md');
    assert.deepEqual(classifyBoardSyncCommit(['-m', 'x'], repo, repo), {
      ok: false,
      reason: 'staged-outside',
      token: 'docs/café.md',
    });
  });
});

describe('classifyBoardSyncCommit — US3 explicit-pathspec audit (Phase 4, T007)', () => {
  test('a non-ASCII backlog/ pathspec is allowed', (t) => {
    const repo = makeRepo(t);
    stage(repo, 'backlog/tâche.md');
    assert.deepEqual(
      classifyBoardSyncCommit(['-m', 'x', '--', 'backlog/tâche.md'], repo, repo),
      { ok: true }
    );
  });

  test('a non-ASCII non-backlog pathspec is refused as pathspec-outside', (t) => {
    const repo = makeRepo(t);
    stage(repo, 'docs/tâche.md');
    assert.deepEqual(
      classifyBoardSyncCommit(['-m', 'x', '--', 'docs/tâche.md'], repo, repo),
      { ok: false, reason: 'pathspec-outside', token: 'docs/tâche.md' }
    );
  });

  test('boardPathspecOk resolves an absolute non-ASCII backlog/ path', (t) => {
    const repo = makeRepo(t);
    stage(repo, 'backlog/tâche.md');
    const abs = join(repo, 'backlog/tâche.md');
    assert.equal(boardPathspecOk(abs, repo), true);
  });
});

describe('classifyBoardSyncCommit — US3 pre-write audit (Phase 4, T008)', () => {
  function runPreWrite(t, filePath, cwd) {
    const repo = cwd;
    return spawnSync(process.execPath, [HOOK_PATH, 'pre-write'], {
      env: { ...process.env, CLAUDE_PROJECT_DIR: repo },
      input: JSON.stringify({ tool_input: { file_path: filePath }, cwd: repo }),
      encoding: 'utf8',
    });
  }

  test('a non-ASCII tracked path at the root is blocked (exit 2)', (t) => {
    const repo = makeRepo(t);
    const target = join(repo, 'docs/tâche.md');
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, 'x\n');
    const result = runPreWrite(t, target, repo);
    assert.equal(result.status, 2);
  });

  test('the same non-ASCII path under .worktrees/ is allowed (exit 0)', (t) => {
    const repo = makeRepo(t);
    const target = join(repo, '.worktrees/x/tâche.md');
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, 'x\n');
    const result = runPreWrite(t, target, repo);
    assert.equal(result.status, 0);
  });
});
