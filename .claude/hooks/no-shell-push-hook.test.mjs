import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { classifyCommand } from './no-shell-push-lib.mjs';

const HOOK = fileURLToPath(new URL('./no-shell-push-hook.mjs', import.meta.url));
const run = (command) =>
  spawnSync('node', [HOOK], { input: JSON.stringify({ tool_input: { command } }), encoding: 'utf8' });

const BLOCKED = [
  'git push', 'git push -u origin HEAD', 'git push --force-with-lease', 'git -C /x push origin main',
  'git -c a=b push', 'cd x && git push', 'FOO=1 git push', 'env GIT_X=1 git push', 'sudo git push',
  'bash -c "git push origin main"', 'echo hi | xargs git push',
  'gh pr create --title x', 'gh pr merge 5 --merge', 'gh pr edit 5', 'gh pr comment 5 -b hi',
  'gh -R a/b pr create', 'gh issue comment 3', 'gh release create v1', 'gh workflow run ci.yml',
  'gh api -X POST repos/a/b/issues', 'gh api --method=PUT x', 'gh api repos/a/b/issues -f title=x',
  'gh api -XDELETE x',
];
const ALLOWED = [
  'git status', 'git log --oneline', 'git commit -m "fix git push docs"', 'git fetch origin',
  'echo "git push"', 'git diff && echo done', 'gh pr view 5', 'gh pr list', 'gh pr diff 5',
  'gh api repos/a/b/pulls', 'gh api -X GET repos/a/b', 'gh issue view 3', 'gh run view 1',
  'git commit -m "$(cat <<\'EOF\'\ngit push\nEOF\n)"',
];

for (const c of BLOCKED) test(`blocks: ${c}`, () => assert.ok(classifyCommand(c), c));
for (const c of ALLOWED) test(`allows: ${c}`, () => assert.equal(classifyCommand(c), null, c));

test('hook exits 2 with connector guidance on git push', () => {
  const r = run('git push --force');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /connector tools/);
});
test('hook exits 0 on benign command and on bad stdin', () => {
  assert.equal(run('git status').status, 0);
  assert.equal(spawnSync('node', [HOOK], { input: 'nope' }).status, 0);
});
