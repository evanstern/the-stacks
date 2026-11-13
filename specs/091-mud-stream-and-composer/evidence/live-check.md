# Live check, spec 091 part 1 (TASK-0247, T030)

Run 2026-11-13 on the worktree stack `stacks-task-0247` (http://localhost:3247), script mode
`greyhollow-live` (boot log: `DM script mode: greyhollow-live (8 calls, 1 dice)`), seed
`greyhollow-ford`, the operator seated as Tamsin. Isolated Playwright contexts on the Brave debug
port, one per viewport and colour scheme: 1280x800 and 390x844, each light and dark. The turn is
`act-search`, declared and committed over the WebSocket (spec 053 `declare.mjs`). No source change.
App image rebuilt from branch tip before the run.

Setup notes:
- The script is consumed per container boot (8 calls). Committed actions from earlier sessions replay
  on restart and eat the script, so before each of the four runs the stack's `events`,
  `dm_model_calls` and `jobs` tables were truncated and the app container recreated. Users kept.
- After the run `DM_FAKE_SCRIPT` was removed from `.env` and the app recreated (no script mode boot line).

## Results

| Check | Result | Notes |
|---|---|---|
| 1. Room block | pass | `section[data-kind=room]` shows "Greyhollow Ford", the description, "Ways on: ladder to the loft, causeway downriver, ferry" and a Party line. 0 buttons or links inside. Same in all four runs |
| 2. Roll row | pass with notes | `details[data-kind=roll]` sits in the `<li>` before the narration prose (li index 3, prose 4). Summary "Tamsin Vale — Investigation 14 ✓ success"; expanded: "d20: 14", "d20: 14 = 14 vs DC 10", "Success (14 vs DC 10)". Check named. Mode is wording-free for a normal roll (words appear only for advantage or disadvantage), so "mode in words" is not shown here. Single d20, no dropped face to show (no `.sr-only` ", dropped", 0 struck faces). `roll-expanded-*.png` |
| 3. Narration filter | pass | Settled narration prose holds no `→` and no `1d20`. The dice line appears once, in the roll row. Kept by design: "DM ruling: accept", "Difficulty: easy", "State: ..." as `data-kind=rules` lines |
| 4. Dialogue rows | pass with note | One `[data-kind=dialogue]`: `Tamsin Vale means to: "I search the ferry-house for whoever cut the bell rope.".` computed font-style `normal` (upright). The scripted DM prose has no quotes. The only quote is the echoed player declaration inside the narration text |
| 5. Filter chips | pass, pinned not live | Group "Filter the stream", buttons All, In character, Table talk, Rules; exactly one `aria-pressed=true` each time. Visible kinds: All room, rules, roll, dialogue. In character room, rules, dialogue. Table talk none. Rules roll only. Pinned: no item was pinned at check time (the action was Resolved), so "stays under every chip" was not exercised |
| 6. Streaming block | pass | `[data-kind=narration-stream]` caught 4-5 times per run, first at t=317-343 ms after the declare. `aria-busy="true"` on every sample, no `aria-live` attribute at any sample. Text first shows the rows ("THE DM IS NARRATING", dice and ruling lines). Gone at settle |
| 7. Layout | pass | At 1280: `[role=log]` 761-776 px wide, centred in the 800 px column beside the sidebar and Party panel. Composer form and its wrapper 1024 px (x 248, 8 px each side of the 1040 px main column). At 390: `scrollWidth` 390 = `clientWidth` 390, composer 390 wide. `[role=dialog]`, `[aria-modal=true]`, `dialog[open]` all 0 in all four runs |
| 8. Accessibility | pass | AX tree (CDP `Accessibility.getFullAXTree`): `log "Table stream"`, `group "Filter the stream"`, buttons All, In character, Table talk, Rules, `form "Composer"`. Keyboard pass (1280 light): Tab reached All, In character, Table talk, Rules in order; Enter toggled Rules on, Space toggled Table talk on (leaving only Table talk pressed) |

Screenshots in this directory: `room-{1280,390}-{light,dark}.png`, `stream-{1280,390}-{light,dark}.png`,
`roll-expanded-{1280,390}-{light,dark}.png`, `chip-{all,in-character,table-talk,rules}-1280.png`.

## Findings (not fixed)

Findings 1 (Rules chip hides narration rules lines), 2 (stray `".` on echoed declaration) and 3 (repeated d20 face list) are fixed in 84636aab. Finding 4 stands as correct per FR-009.

1. Under the Rules chip only the roll row stays visible. The `data-kind=rules` lines that come out of
   narration ("DM ruling", "Difficulty", "State: ...") disappear, because they ride the narration item,
   which is category in-character. If those lines are meant to count as Rules, they need their own
   stream item. Under In character they stay.
2. The roll row detail repeats the die: "d20: 14" then "d20: 14 = 14 vs DC 10".
3. The echoed player declaration `Tamsin Vale means to: "...".` becomes a dialogue row (a quote in
   narration text), with a stray `".` at the end.
4. The Table talk chip empties the stream, room block included (the room block is category in-character,
   not pinned). Matches the pinned definition (open confirm or own open action), so likely intended.

## Not run live

- Advantage or disadvantage roll, so no dropped d20 face (script has one d20, normal mode).
- Pinned items under every chip (no confirm line or open own action at check time).
- A quote in DM prose (script has none).
- Table talk and out-of-character rows (the script has none; chip showed empty).
- Pills, verb dropdown, Tab completion: TASK-0329.
