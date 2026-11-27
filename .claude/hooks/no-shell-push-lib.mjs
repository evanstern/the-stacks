// no-shell-push-lib.mjs — pure classifier for rule 13 (INF-37 / INF-39):
// all GitHub writes go through the Paperclip GitHub connector tools, never
// shell `git push` or `gh` write commands. Reuses the quote-aware scanner so a
// `git push` inside a quoted commit message or heredoc is not a violation.
import { scanCommand } from './shell-scan.mjs';

export const GUIDANCE =
  'Rule 13 (INF-37): push and open PRs only through the Paperclip GitHub connector tools ' +
  '(push-files, create-or-update-file, delete-file, create-branch, create-pull-request, ' +
  'update-pull-request, merge-pull-request, ...). Never shell `git push` (any form) or `gh` ' +
  'write commands (`gh pr create|merge|edit|comment`, non-GET `gh api`). If the connector lacks ' +
  'access, request it via connections_search/connection_request and block on the card.';

const WRAPPERS = new Set(['env', 'command', 'sudo', 'exec', 'nohup', 'time', 'nice', 'builtin']);
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash']);
const GIT_OPTS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path']);
const GH_OPTS_WITH_VALUE = new Set(['-R', '--repo', '--hostname']);
// Verbs that mutate GitHub state under any `gh <noun>`.
const GH_WRITE_VERBS = new Set([
  'create', 'merge', 'edit', 'comment', 'close', 'reopen', 'review', 'ready', 'lock', 'unlock',
  'delete', 'upload', 'run', 'rerun', 'cancel', 'fork', 'transfer', 'archive', 'unarchive',
  'rename', 'sync', 'set', 'remove', 'add', 'develop', 'pin', 'unpin', 'enable', 'disable',
  'update-branch', 'import', 'delete-asset',
]);
const GH_API_FIELD_FLAGS = /^(-f|-F|--field|--raw-field|--input)(=|$)/;

function stripPrefix(tokens) {
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t) || WRAPPERS.has(t) || (WRAPPERS.has(tokens[i - 1]) && t.startsWith('-'))) i++;
    else break;
  }
  return tokens.slice(i);
}

function gitSubcommand(args) {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (GIT_OPTS_WITH_VALUE.has(a)) { i++; continue; }
    if (a.startsWith('-')) continue;
    return a;
  }
  return null;
}

function ghPositionals(args) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (GH_OPTS_WITH_VALUE.has(a)) { i++; continue; }
    if (a.startsWith('-')) continue;
    out.push(a);
  }
  return out;
}

function ghApiIsWrite(args) {
  let method = null;
  let hasField = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-X' || a === '--method') method = args[++i] ?? '';
    else if (a.startsWith('--method=')) method = a.slice(9);
    else if (/^-X./.test(a)) method = a.slice(2);
    else if (GH_API_FIELD_FLAGS.test(a)) hasField = true;
  }
  if (method !== null) return method.toUpperCase() !== 'GET' || false;
  return hasField; // fields default the method to POST
}

function classifyTokens(rawTokens, depth) {
  const tokens = stripPrefix(rawTokens);
  if (tokens.length === 0) return null;
  const head = tokens[0].split('/').pop();
  if (head === 'git') {
    return gitSubcommand(tokens.slice(1)) === 'push' ? 'git push' : null;
  }
  if (head === 'gh') {
    const args = tokens.slice(1);
    const pos = ghPositionals(args);
    if (pos[0] === 'api') return ghApiIsWrite(args.slice(args.indexOf('api') + 1)) ? 'gh api (non-GET)' : null;
    if (pos.length >= 2 && GH_WRITE_VERBS.has(pos[1])) return `gh ${pos[0]} ${pos[1]}`;
    return null;
  }
  if (SHELLS.has(head) && depth < 3) {
    const ci = tokens.findIndex((t) => /^-[a-z]*c[a-z]*$/.test(t));
    if (ci !== -1 && tokens[ci + 1] !== undefined) return classifyCommand(tokens[ci + 1], depth + 1);
  }
  if (head === 'xargs' && depth < 3) return classifyTokens(tokens.slice(1), depth + 1);
  return null;
}

/** @returns {string|null} the offending command family, or null if allowed. */
export function classifyCommand(command, depth = 0) {
  const scan = scanCommand(command);
  if (!scan.ok) {
    // Fail closed only when the text clearly names a write; otherwise allow.
    return /\bgit\b[^\n]*\bpush\b|\bgh\s+(pr|api|issue|release|repo|workflow)\b/.test(command) ? 'unparseable git/gh command' : null;
  }
  for (const segment of scan.segments) {
    const hit = classifyTokens(segment.map((t) => t.value), depth);
    if (hit) return hit;
  }
  return null;
}
