# TASK-0191 evidence: play route header and composer stay in view

Fixture: `dm-approvals` (`/play/fixtures/dm-approvals`, operator sign-in on the worktree stack, port 3191).

## Method

1. Sign in as the local test operator through `POST /auth/sign-in`, then set the `session` cookie.
2. Send 30 talk lines through the composer (`talk line 1` to `talk line 30`). The fixture is local, so sends append only to the page.
3. Find the transcript scroller: the nearest ancestor of the `talk line 30` entry with `overflow-y` auto or scroll and `scrollHeight > clientHeight`.
4. Set `scrollTop = 0`, record the numbers, and take `1280-light-top.png`. Then set `scrollTop = scrollHeight - clientHeight`, record again, and take the screenshot.
5. Repeat at 1280x800 and 390x844, in light and dark, via `Emulation.setEmulatedMedia`.

`headerTop` is the top edge of the Ledger button in the table header, not the header container. `composerBottom` is the bottom edge of the Send button.

## Numbers

| Viewport | Scheme | Transcript scrollHeight / clientHeight | scrollTop top → bottom | headerTop (>= 0) | composerBottom (<= innerHeight) | docScrollHeight / innerHeight |
|---|---|---|---|---|---|---|
| 1280x800 | light | 1206 / 569 | 0 → 637 | 58 | 764 <= 800 | 800 / 800 |
| 1280x800 | dark | 1206 / 569 | 0 → 637 | 58 | 764 <= 800 | 800 / 800 |
| 390x844 | light | 1206 / 369 | 0 → 837 | 169 | 752 <= 844 | 844 / 844 |
| 390x844 | dark | 1206 / 369 | 0 → 837 | 169 | 752 <= 844 | 844 / 844 |

The header top stays at the same position after scrolling to the bottom in all four runs. The transcript moves, the page does not scroll.

## Screenshots

- `1280-light-top.png`: transcript at the top, 1280x800, light.
- `1280-light.png`, `1280-dark.png`, `390-light.png`, `390-dark.png`: transcript scrolled to the bottom.
