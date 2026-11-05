# Spec 090 live check (2026-11-05)

- Stack: `stacks-mud-ux` worktree stack at branch HEAD 6c4826cb (phases 1 and 2), both databases migrated.
- Browser: the in-app browser pane (Chromium-based), not Brave. Brave automation was not available to this session.
- Route: `/play/fixtures/turn-mode-combat`, as Player 1 (Ana), `through=15` (Ana's turn, combat) and the full log (free play after combat).

| Shot | Width | Theme | Seen |
|---|---|---|---|
| `combat-1280-light.jpg` | 1280 | light | The margin shows Party (Ana HP 12/12 AC 15, Bram HP 10/10 AC 14), Turn order (Ana you, Bram next, Goblin) and Conditions: none. The status strip reads "Ana · HP 12/12 · AC 15 · Conditions: none · Turn: Ana (you)". No turn-order strip sits under the header. |
| `combat-1280-dark.jpg` | 1280 | dark | Same content. Daylight dark tokens. |
| `combat-390-light.jpg` | 390 | light | The margin is hidden. The mini-strip reads "Bram 10/10 · Order: Ana › Bram › Goblin", with the status strip under it, above the composer. |
| `combat-390-dark.jpg` | 390 | dark | Same content. |
| `free-play-1280-light.jpg` | 1280 | light | Full log, DM view: "Not in combat.", status strip "Turn: free play". |

DOM checks at 390 px, dark: 0 `dialog` / `aria-modal` / `role=dialog`; aside "Table state" is `display: none`; mini and status strips are visible.

Gates on the branch: `pnpm ci:check` with `REQUIRE_DATABASE=1` and a migrated test DB passes 11/11 tasks (server 1787 passed, 5 skipped). Wiki freshness prints OK.

Observation, not a defect against spec 090: at 390 px, other party members' conditions are not shown; the mini-strip carries HP only. Spec 091 adds stream parity lines for conditions.
