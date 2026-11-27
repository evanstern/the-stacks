// no-shell-push-hook.mjs — Claude Code PreToolUse(Bash) guard (INF-39, rule 13).
// Exit 2 + stderr message when the command is a shell GitHub write.
import { readFileSync } from 'node:fs';
import { classifyCommand, GUIDANCE } from './no-shell-push-lib.mjs';

function main() {
  let command;
  try {
    command = JSON.parse(readFileSync(0, 'utf8'))?.tool_input?.command;
  } catch {
    return; // malformed stdin: fail open (matches root-guard)
  }
  if (typeof command !== 'string') return;
  const hit = classifyCommand(command);
  if (hit) {
    process.stderr.write(`no-shell-push: blocked \`${hit}\`.\n${GUIDANCE}\n`);
    process.exit(2);
  }
}
main();
