#!/usr/bin/env node
// root-guard-hook.mjs — harness-level (Claude Code) enforcement of the
// root-read-only + worktree-only workflow doctrine, wired into a HOST's
// .claude/settings.json as a PreToolUse hook. Shipped from pdlc (TASK-101 /
// spec 051); PLANTED into an adopting host — it does NOT run in a pdlc session
// (there is deliberately no hooks.json beside this file, so the marketplace
// never auto-registers it; see specs/051 Phase 1 note #4).
//
// This is the HARDENED replacement for promptworld's
// scripts/hooks/root-guard-hook.mjs. The policy is ported VERBATIM in
// behavior — only the PARSING is changed. The upstream classifier parsed the
// raw command string with two quote-blind regexes (a boundary class
// `[;|&\n`)]` and a tokenizer `("[^"]*"|'[^']*'|\S+)`); a `-m` message
// containing a newline or a `)` truncated the segment mid-quote and shattered
// the message into bare words read as pathspecs, so the default-correct
// `Co-Authored-By: Claude Opus 5 (1M context) <noreply@…>` trailer reliably
// tripped the gate. Here that parse is replaced by the quote-state scanner in
// ./shell-scan.mjs (spec 051 R2 + R5(b)). See spec 051 §"The defect".
//
// Contract (unchanged from upstream): NOTHING is modified in the root checkout
// directly. Every change is authored on a branch in a worktree under
// .worktrees/ and reaches main ONLY by merge. ONE ratified exception
// (TASK-161): board-sync commits scoped entirely to backlog/ are allowed at
// root (the board is the plan of record and the concurrent-session mutex). The
// exception applies to pre-bash `git commit` ONLY: pre-write still blocks
// Write/Edit of backlog/ at root (the backlog CLI via Bash is the sanctioned
// editor). Rebases are forbidden everywhere in this repo.
//
// Node >= 18, ESM, zero npm dependencies (stdlib fs/path/child_process only).
//
// Usage (selected by argv[2], invoked by the host's .claude/settings.json):
//
//   node root-guard-hook.mjs pre-bash
//     PreToolUse hook on Bash. Reads hook input JSON from stdin
//     ({ tool_input: { command }, cwd, ... }). Finds EVERY command-position
//     git invocation (via shell-scan) and, per invocation, resolves its
//     effective dir (hook cwd, adjusted by each `cd <path>` segment before it,
//     then by `-C <path>` git-global options). Per invocation:
//
//       BLOCK anywhere IN JURISDICTION (root AND worktrees under this project):
//         rebase                          (rebases forbidden repo-wide)
//         push --force | --force-with-lease[=…] | --force-if-includes | -f
//
//       BLOCK only when the invocation runs AT THE ROOT CHECKOUT (its
//       `rev-parse --show-toplevel` realpath-equals $CLAUDE_PROJECT_DIR —
//       worktrees have their OWN toplevel and pass as NOT root):
//         commit          `--amend` denied OUTRIGHT — checked BEFORE both
//                         allow paths. Otherwise allowed only if one of two
//                         allow paths holds, checked in order:
//                         (1) MERGE_HEAD present (concluding a merge) — FIRST,
//                             so a conflicted-merge conclusion is never forced
//                             through the board-sync rule;
//                         (2) board-sync exception (TASK-161) — scoped entirely
//                             to backlog/ (no -a/--all/--interactive/-p/--patch/
//                             -i/--include; no --pathspec-from-file; every
//                             explicit pathspec — or, with none, every staged
//                             path — under backlog/).
//         cherry-pick, revert, am
//         merge --squash  (plain merge is ALLOWED — it is how branches land)
//         checkout -b/-B, switch -c/-C/--create/--force-create  (branch create)
//
//       ALLOW everything else, and any invocation whose resolved toplevel is
//       OUT OF JURISDICTION (a different repository the session merely touches
//       — spec 051 R5(a)): reads, fetch, pull, plain merge, push, worktree
//       add/remove, branch -d, status/log/diff. Non-git commands always pass.
//
//   node root-guard-hook.mjs pre-write
//     PreToolUse hook on Write|Edit|NotebookEdit. Ported unchanged from
//     upstream (spec 051 declares the pre-write policy out of scope for
//     revision; it is carried as-is because this file is the host's whole hook).
//
// Exit codes (both subcommands):
//   0  allow — no git match, out of jurisdiction, malformed/unparseable stdin,
//      internal error, or all rules pass (fail-OPEN on everything except an
//      actual rule violation)
//   2  block — a rule fired; explanatory message on stderr
//
// No bypass: there is deliberately NO env-var escape hatch. Emergencies go
// through the operator editing the hook config (.claude/settings.json).
//
// ---------------------------------------------------------------------------
// scan-failure (ok:false) POLICY — spec 051 R2, decided in Phase 3 from
// measured evidence (recorded in specs/051-root-guard-hook/tasks.md Notes):
//
// The scanner fails closed (returns { ok:false } with NO tokens) on an
// unbalanced quote or dangling escape, so a caller can never mistake shredded
// words for pathspecs. But two legitimate, executable command shapes look
// "unparseable" to a shell-word scanner:
//   (1) HEREDOCS — `git commit -F - <<'EOF' … EOF`. The body is not shell
//       text; an apostrophe or lone quote in it makes the whole command scan
//       ok:false, and even a BALANCED body mentioning "git …" would be misread
//       as a command-position invocation. Heredocs are a sanctioned pattern
//       (the card names `-F` as the existing workaround; the sweep orchestrator
//       uses `git commit -F - <<'EOF'`). This file therefore STRIPS heredoc
//       operator tokens + bodies BEFORE scanning (stripHeredocs, below), so the
//       sanctioned pattern parses to `git commit -F -` and is evaluated
//       normally (no pathspecs ⇒ the staged set decides board-sync). This keeps
//       BOTH directions correct: a backlog-only heredoc commit is ALLOWED, a
//       non-backlog heredoc commit is BLOCKED (spec 051 R4 preserved).
//   (2) After heredoc stripping, a RESIDUAL ok:false means a genuinely
//       unbalanced quote (a shell SYNTAX error that will not execute) or an
//       exotic quoting form the scanner does not model (`$'…'`, `$"…"`). The
//       hook FAILS OPEN on the residual — consistent with its documented
//       fail-open posture (malformed stdin ⇒ exit 0; internal error ⇒ exit 0)
//       and with the reality that a truly-unbalanced command does not run.
//       This is a DELIBERATE, RECORDED deviation from spec 051 R2's literal
//       "an unparseable command is not an allowed command / fail closed": a
//       blanket fail-closed on residual ok:false would block non-git commands
//       carrying an apostrophe (violating "non-git commands always pass") and
//       out-of-jurisdiction commits (violating R5(a)), because ok:false yields
//       no reliable subcommand, target repo, or pathspecs to scope the block.
//       The narrow residual gap (an exotic-quoted ROOT commit bypassing the
//       board-sync gate) is rare, in the same direction as the hook's existing
//       accepted limit that shell-level mutation cannot be intercepted, and is
//       the recorded trade-off. See tasks.md Notes for the full rationale.
// ---------------------------------------------------------------------------

import { existsSync, realpathSync, readFileSync } from 'node:fs';
import { resolve as resolvePath, dirname, basename, join as joinPath } from 'node:path';
import { execFileSync } from 'node:child_process';

import { scanCommand, findGitInvocations } from './shell-scan.mjs';

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function tryExec(cmd, args, opts = {}) {
  try {
    const stdout = execFileSync(cmd, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      ...opts,
    });
    return { status: 0, stdout, stderr: '' };
  } catch (err) {
    return {
      status: typeof err.status === 'number' ? err.status : 1,
      stdout: err.stdout ? err.stdout.toString() : '',
      stderr: err.stderr ? err.stderr.toString() : String(err.message || err),
    };
  }
}

function realOrNull(p) {
  try {
    return realpathSync(p);
  } catch {
    return null;
  }
}

// Resolve a possibly-nonexistent absolute path to its real form: realpath the
// nearest EXISTING ancestor, then re-append the nonexistent tail. Returns null
// on any resolution failure (fail open).
function realResolve(absPath) {
  let cur = absPath;
  const tail = [];
  while (!existsSync(cur)) {
    tail.unshift(basename(cur));
    const parent = dirname(cur);
    if (parent === cur) return null;
    cur = parent;
  }
  const real = realOrNull(cur);
  if (!real) return null;
  return tail.length ? joinPath(real, ...tail) : real;
}

// ---------------------------------------------------------------------------
// Heredoc stripping (see the scan-failure POLICY note above). Removes each
// unquoted `<<[-]DELIM` operator token AND its body from `command`, so the
// command's ARGV parses cleanly and a heredoc body is never scanned as shell
// text. Quote-aware ONLY enough to (a) not treat a `<<` inside a quoted string
// as a heredoc, and (b) reproduce all non-heredoc text verbatim; the real
// tokenization is scanCommand's job afterwards.
//
// Handles the common forms: `<<EOF`, `<<-EOF` (tab-stripped terminator),
// `<<'EOF'`, `<<"EOF"`, `<<\EOF`, with optional whitespace after `<<`. The
// rest of the operator's own line (e.g. `… <<'EOF' && echo done`) is
// PRESERVED — only the operator token and the subsequent body lines through the
// terminator are removed. Documented limits: one heredoc handled per operator
// position (looping covers several in sequence); a missing terminator strips to
// end of input.
function stripHeredocs(command) {
  let out = '';
  let i = 0;
  const n = command.length;
  let inSingle = false;
  let inDouble = false;

  while (i < n) {
    const ch = command[i];

    if (inSingle) {
      out += ch;
      if (ch === "'") inSingle = false;
      i++;
      continue;
    }
    if (inDouble) {
      if (ch === '\\' && i + 1 < n) {
        out += ch + command[i + 1];
        i += 2;
        continue;
      }
      out += ch;
      if (ch === '"') inDouble = false;
      i++;
      continue;
    }
    // outside quotes
    if (ch === '\\' && i + 1 < n) {
      out += ch + command[i + 1];
      i += 2;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      out += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      out += ch;
      i++;
      continue;
    }

    if (ch === '<' && command[i + 1] === '<') {
      let j = i + 2;
      let dashStrip = false;
      if (command[j] === '-') {
        dashStrip = true;
        j++;
      }
      while (command[j] === ' ' || command[j] === '\t') j++;
      // Read the delimiter word (optionally quoted / backslash-prefixed).
      let delim = '';
      if (command[j] === "'" || command[j] === '"') {
        const q = command[j];
        j++;
        while (j < n && command[j] !== q) {
          delim += command[j];
          j++;
        }
        if (j < n) j++; // closing quote
      } else {
        if (command[j] === '\\') j++; // `<<\EOF`
        while (j < n && /[A-Za-z0-9_]/.test(command[j])) {
          delim += command[j];
          j++;
        }
      }
      if (delim === '') {
        // Not a recognizable heredoc (e.g. `a << b` with no word): emit `<<`
        // literally and move on.
        out += '<<';
        i += 2;
        continue;
      }
      // Drop the operator token `<<...delim` (append nothing). Preserve the
      // rest of the operator's own line, then skip the body through the
      // terminator line.
      const nl = command.indexOf('\n', j);
      if (nl === -1) {
        // No newline after the operator ⇒ no body present ⇒ drop operator only.
        i = j;
        continue;
      }
      out += command.slice(j, nl + 1); // rest-of-line incl. newline
      let k = nl + 1;
      while (k < n) {
        let lineEnd = command.indexOf('\n', k);
        if (lineEnd === -1) lineEnd = n;
        const line = command.slice(k, lineEnd);
        const test = dashStrip ? line.replace(/^\t+/, '') : line;
        k = lineEnd < n ? lineEnd + 1 : n;
        if (test === delim) break; // terminator consumed
      }
      i = k;
      // Quote state is naturally outside here (body was raw text).
      continue;
    }

    out += ch;
    i++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Git-global option tables (parsed BEFORE the subcommand). Ported verbatim.
const GIT_GLOBAL_WITH_ARG = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace']);
const GIT_GLOBAL_NO_ARG = new Set(['-p', '--paginate', '--no-pager', '--exec-path']);
const GIT_GLOBAL_INLINE_PREFIXES = ['--git-dir=', '--work-tree=', '--exec-path=', '--namespace='];

// From an invocation's already-tokenized values (tokens[0] === 'git'), walk the
// git-global options to find the subcommand. Returns { subcommand, args, cPaths }
// where `args` is the post-subcommand token VALUES and `cPaths` the ordered
// `-C` values (each applied relative to the prior effective dir, matching git's
// own -C chaining). This is the same two-layer parse as upstream — the crucial
// distinction it preserves: a git-global `-p` (paginate) BEFORE the subcommand
// vs a post-subcommand `-p` (`--patch`, which DENIES the board-sync exception).
function parseGitInvocation(tokenValues) {
  let i = 1; // tokenValues[0] === 'git'
  const cPaths = [];
  while (i < tokenValues.length) {
    const tok = tokenValues[i];
    if (!tok.startsWith('-')) break; // subcommand found
    if (tok === '-C') {
      if (tokenValues[i + 1] !== undefined) cPaths.push(tokenValues[i + 1]);
      i += 2;
      continue;
    }
    if (GIT_GLOBAL_WITH_ARG.has(tok)) {
      i += 2;
      continue;
    }
    if (GIT_GLOBAL_NO_ARG.has(tok) || GIT_GLOBAL_INLINE_PREFIXES.some((p) => tok.startsWith(p))) {
      i += 1;
      continue;
    }
    // Unknown dash token before the subcommand: skip it (fail-open — rather
    // miss a subcommand than misidentify one).
    i += 1;
  }
  if (i >= tokenValues.length) return { subcommand: null, args: [], cPaths };
  return { subcommand: tokenValues[i], args: tokenValues.slice(i + 1), cPaths };
}

// ---------------------------------------------------------------------------
// Board-sync exception (TASK-161). Option tables ported VERBATIM.
const COMMIT_LONG_WITH_VALUE = new Set([
  '--message', '--file', '--reuse-message', '--reedit-message', '--fixup',
  '--squash', '--author', '--date', '--cleanup', '--pathspec-from-file',
  '--template', '--trailer',
]);
const COMMIT_LONG_DENY = new Set(['--all', '--interactive', '--patch', '--include']);
const COMMIT_SHORT_WITH_VALUE = 'mFcCt';
const COMMIT_SHORT_DENY = 'api';

// Is this pathspec token entirely under backlog/? Relative paths must start
// with `backlog/` (after stripping a leading `./`); absolute paths must
// realpath-resolve strictly under <root>/backlog/.
function boardPathspecOk(tok, realProjectDir) {
  let p = tok;
  while (p.startsWith('./')) p = p.slice(2);
  if (p.startsWith('/')) {
    const real = realResolve(p);
    if (!real) return false;
    return real.startsWith(joinPath(realProjectDir, 'backlog') + '/');
  }
  return p.startsWith('backlog/');
}

// Classify a root `git commit` invocation for the board-sync exception.
// Fail-CLOSED within the exception (anything unverifiable ⇒ not board-sync).
// Returns { ok: true } to allow, or { ok: false, reason, token? } to deny —
// `reason`/`token` carry the finding so the refusal can name the SPECIFIC token
// read as an out-of-scope pathspec (spec 051 R3).
function classifyBoardSyncCommit(args, effDir, realProjectDir) {
  const pathspecs = [];
  let afterDashDash = false;
  for (let i = 0; i < args.length; i++) {
    const tok = args[i];
    if (afterDashDash) {
      pathspecs.push(tok);
      continue;
    }
    if (tok === '--') {
      afterDashDash = true;
      continue;
    }
    if (!tok.startsWith('-')) {
      pathspecs.push(tok);
      continue;
    }
    // Long option.
    if (tok.startsWith('--')) {
      if (tok === '--pathspec-from-file' || tok.startsWith('--pathspec-from-file=')) {
        return { ok: false, reason: 'pathspec-from-file' }; // cannot statically verify
      }
      const eq = tok.indexOf('=');
      const name = eq === -1 ? tok : tok.slice(0, eq);
      if (COMMIT_LONG_DENY.has(name)) return { ok: false, reason: 'deny-flag', token: name };
      if (eq === -1 && COMMIT_LONG_WITH_VALUE.has(name)) i += 1; // skip value
      continue; // any other long flag: skip, consumes nothing
    }
    // Short option, possibly clustered (-am) or with embedded value (-mMSG).
    const cluster = tok.slice(1);
    for (let j = 0; j < cluster.length; j++) {
      const ch = cluster[j];
      if (COMMIT_SHORT_DENY.includes(ch)) {
        return { ok: false, reason: 'deny-flag', token: `-${ch}` };
      }
      if (COMMIT_SHORT_WITH_VALUE.includes(ch)) {
        if (j === cluster.length - 1) i += 1; // value is the next token
        break;
      }
      // Benign valueless short flag (-s, -n, -v, -q, -e, ...): keep walking.
    }
  }

  if (pathspecs.length > 0) {
    // Explicit pathspecs: every one must be under backlog/ (git commits exactly
    // these paths regardless of what else is staged).
    for (const p of pathspecs) {
      if (!boardPathspecOk(p, realProjectDir)) {
        return { ok: false, reason: 'pathspec-outside', token: p };
      }
    }
    return { ok: true };
  }

  // No pathspecs: the staged set decides — non-empty and entirely backlog/.
  const staged = tryExec('git', ['-C', effDir, 'diff', '--cached', '--name-only']);
  if (staged.status !== 0) return { ok: false, reason: 'staged-query-failed' };
  const files = staged.stdout.split('\n').filter((l) => l.trim() !== '');
  if (files.length === 0) return { ok: false, reason: 'nothing-staged' };
  for (const f of files) {
    if (!f.startsWith('backlog/')) return { ok: false, reason: 'staged-outside', token: f };
  }
  return { ok: true };
}

// Build the R3 finding clause for a denied board-sync commit.
function boardSyncFinding(result) {
  switch (result.reason) {
    case 'pathspec-outside':
      return `read \`${result.token}\` as a pathspec outside backlog/`;
    case 'staged-outside':
      return `the staged path \`${result.token}\` is outside backlog/`;
    case 'deny-flag':
      return `\`${result.token}\` widens staging beyond explicit backlog/ pathspecs`;
    case 'pathspec-from-file':
      return '`--pathspec-from-file` names a pathspec source that cannot be statically verified';
    case 'nothing-staged':
      return 'nothing is staged, so the commit cannot be verified as board-sync';
    case 'staged-query-failed':
      return 'the staged set could not be read to verify board-sync scope';
    default:
      return 'the commit is not scoped entirely to backlog/';
  }
}

function block(sub, rule) {
  process.stderr.write(
    `root-guard: blocked \`git ${sub}\` — ${rule}.\n` +
      'The root checkout is READ-ONLY: author changes on a branch in .worktrees/<task-branch> ' +
      'and land them on main only by merge (PR `gh pr merge --merge` or manual `git merge --no-ff` at root). ' +
      'Rebases are forbidden repo-wide.\n' +
      'See CLAUDE.md "Root checkout is READ-ONLY — worktree + merge only, no rebases". ' +
      'No bypass flag — emergencies go through the operator editing hook config, visibly and deliberately.\n'
  );
  process.exit(2);
}

function runPreBash() {
  const raw = readStdin();
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0); // malformed/empty stdin: fail open
  }
  if (!input || typeof input !== 'object') process.exit(0);

  const command = input?.tool_input?.command;
  if (typeof command !== 'string' || command.trim() === '') process.exit(0);

  // Jurisdiction root: CLAUDE_PROJECT_DIR must be set and resolvable.
  const projectDir = process.env.CLAUDE_PROJECT_DIR;
  if (!projectDir) process.exit(0);
  const realProjectDir = realOrNull(projectDir);
  if (!realProjectDir) process.exit(0);

  const baseCwd = typeof input.cwd === 'string' && input.cwd ? input.cwd : process.cwd();

  // Strip heredoc bodies BEFORE scanning (see scan-failure POLICY note), then
  // scan with the quote-state scanner.
  const stripped = stripHeredocs(command);
  const scan = scanCommand(stripped);
  if (!scan.ok) process.exit(0); // residual unparseable ⇒ fail open (POLICY note)

  // Walk segments in order, threading an effective cwd through `cd` segments.
  // Each git segment's effDir = running cwd adjusted by its own `-C` options.
  let runningDir = baseCwd;
  for (const segment of scan.segments) {
    if (segment.length === 0) continue;
    const head = segment[0].value;

    if (head === 'cd') {
      // Last non-flag token is the target (handles `cd /x`, `cd -P /x`).
      let target = null;
      for (let t = segment.length - 1; t >= 1; t--) {
        if (!segment[t].value.startsWith('-')) {
          target = segment[t].value;
          break;
        }
      }
      if (target && target !== '-') {
        const resolved = resolvePath(runningDir, target);
        if (existsSync(resolved)) runningDir = resolved;
      }
      continue;
    }

    if (head !== 'git') continue; // non-git command: always pass

    const inv = parseGitInvocation(segment.map((t) => t.value));
    if (!inv.subcommand) continue; // bare `git`, `git --version`, …

    // Per-invocation effective dir: running cwd, then each `-C` in order.
    let effDir = runningDir;
    for (const p of inv.cPaths) {
      const resolved = resolvePath(effDir, p);
      if (existsSync(resolved)) effDir = resolved;
    }

    // Resolve the repo this invocation actually targets, and key jurisdiction
    // on that repo's TOPLEVEL (spec 051 R5(a)). This is the fix for the
    // cross-repo false-positive: the staged-set query below must never run
    // against the host repo when the invocation targets a different one.
    const realEff = realOrNull(effDir);
    if (!realEff) continue; // unresolvable effDir: fail open
    const top = tryExec('git', ['-C', effDir, 'rev-parse', '--show-toplevel']);
    if (top.status !== 0) continue; // not a git repo: nothing to guard
    const realTop = realOrNull(top.stdout.trim());
    if (!realTop) continue;

    // OUT OF JURISDICTION: the invocation's repo is not this project (nor a
    // worktree under it). The guard governs its own repo, not every repo a
    // session touches. Pass — explicitly, BEFORE any staged-set query.
    const inJurisdiction =
      realTop === realProjectDir || realTop.startsWith(realProjectDir + '/');
    if (!inJurisdiction) continue;

    const isRoot = realTop === realProjectDir; // worktrees have their own toplevel

    const sub = inv.subcommand;
    const args = inv.args;

    // Repo-wide rules (root AND worktrees in this project).
    if (sub === 'rebase') {
      block(
        sub,
        'rebases are forbidden everywhere in this repo; freshen a branch by merging main INTO it'
      );
    }
    if (sub === 'push' && args.some((a) => a === '-f' || a.startsWith('--force'))) {
      block(sub, 'force-pushes are forbidden everywhere in this repo');
    }

    if (!isRoot) continue; // worktree: root-only rules do not apply

    // --- root-only rules ---
    if (sub === 'commit') {
      // `--amend` at root denied OUTRIGHT, before either allow path.
      if (args.includes('--amend')) {
        block(
          sub,
          "`git commit --amend` at the root checkout rewrites the previous root commit (possibly a merge landing or another session's board push); main history is append-by-merge only — a board fix-up is a second board-sync commit"
        );
      }
      // Allow path 1 (checked FIRST): concluding a merge (MERGE_HEAD present).
      const mergeHead = tryExec('git', ['-C', effDir, 'rev-parse', '-q', '--verify', 'MERGE_HEAD']);
      if (mergeHead.status !== 0) {
        // Allow path 2: the board-sync exception (TASK-161).
        const verdict = classifyBoardSyncCommit(args, effDir, realProjectDir);
        if (!verdict.ok) {
          block(
            sub,
            `${boardSyncFinding(verdict)} — direct commits at the root checkout are forbidden ` +
              'EXCEPT board-sync commits scoped entirely to backlog/ (TASK-161: no ' +
              '-a/--patch/--include, every pathspec — or, with none, every staged path — under ' +
              'backlog/) and merge-concluding commits (MERGE_HEAD present)'
          );
        }
      }
    } else if (sub === 'cherry-pick' || sub === 'revert' || sub === 'am') {
      block(sub, `\`git ${sub}\` writes history at the root checkout; main only advances by merge`);
    } else if (sub === 'merge' && args.includes('--squash')) {
      block(
        sub,
        'squash merges at root are forbidden (they rewrite branch pins out of history); use a plain merge'
      );
    } else if (
      (sub === 'checkout' && args.some((a) => a === '-b' || a === '-B')) ||
      (sub === 'switch' &&
        args.some((a) => a === '-c' || a === '-C' || a === '--create' || a === '--force-create'))
    ) {
      block(
        sub,
        'branch creation at the root checkout is forbidden; cut a worktree instead (`git worktree add .worktrees/task-<N> -b <branch> origin/main`)'
      );
    }
    // Everything else at root (fetch, pull, plain merge, push, worktree,
    // branch -d, status/log/diff, …) is allowed.
  }

  process.exit(0);
}

function runPreWrite() {
  const raw = readStdin();
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0); // malformed/empty stdin: fail open
  }
  if (!input || typeof input !== 'object') process.exit(0);

  const filePath = input?.tool_input?.file_path ?? input?.tool_input?.notebook_path;
  if (typeof filePath !== 'string' || filePath.trim() === '') process.exit(0);

  const projectDir = process.env.CLAUDE_PROJECT_DIR;
  if (!projectDir) process.exit(0);
  const realProjectDir = realOrNull(projectDir);
  if (!realProjectDir) process.exit(0);

  const baseCwd = typeof input.cwd === 'string' && input.cwd ? input.cwd : process.cwd();
  const abs = resolvePath(baseCwd, filePath);
  const realAbs = realResolve(abs);
  if (!realAbs) process.exit(0); // unresolvable: fail open

  // Out of jurisdiction: path not inside the project.
  if (realAbs !== realProjectDir && !realAbs.startsWith(realProjectDir + '/')) {
    process.exit(0);
  }

  // Worktrees are where changes are authored — always allowed.
  if (realAbs.startsWith(joinPath(realProjectDir, '.worktrees') + '/')) {
    process.exit(0);
  }

  // Gitignored paths are not part of the checkout's tracked state
  // (.handoff/, .claude/settings.local.json, .worktrees/ itself, …).
  const ign = tryExec('git', ['-C', realProjectDir, 'check-ignore', '-q', '--', realAbs]);
  if (ign.status === 0) process.exit(0); // ignored: allowed
  if (ign.status !== 1) process.exit(0); // check-ignore error: fail open

  // Tracked or would-be-tracked file in the root checkout: BLOCK.
  process.stderr.write(
    `root-guard: blocked write to ${realAbs} — the root checkout is READ-ONLY.\n` +
      'Author this change on a branch in a worktree (.worktrees/<task-branch>) and land it on main by merge ' +
      '(PR `gh pr merge --merge` or manual `git merge --no-ff` at root).\n' +
      'See CLAUDE.md "Root checkout is READ-ONLY — worktree + merge only, no rebases". ' +
      'No bypass flag — emergencies go through the operator editing hook config, visibly and deliberately.\n'
  );
  process.exit(2);
}

function main() {
  const sub = process.argv[2];
  if (sub === 'pre-bash') {
    try {
      runPreBash();
    } catch {
      process.exit(0); // any internal hook error fails open
    }
  } else if (sub === 'pre-write') {
    try {
      runPreWrite();
    } catch {
      process.exit(0); // any internal hook error fails open
    }
  } else {
    process.exit(0);
  }
}

// Exported for unit testing without the stdin contract (Phase 4 hazard suite).
export { stripHeredocs, parseGitInvocation, classifyBoardSyncCommit, boardPathspecOk };

// Only run when invoked directly (not when imported by a test).
if (
  process.argv[1] &&
  realOrNull(process.argv[1]) === realOrNull(new URL(import.meta.url).pathname)
) {
  main();
}
