# Live check, spec 105 Phase 5 (T032-T034)

Run 2026-11-12 on the worktree stack `stacks-task-0315` (http://localhost:3315), script mode
`greyhollow-confirm` (boot log: `DM script mode: greyhollow-confirm (7 calls, 0 dice)`), seed
`greyhollow-ford-duo`: an AI DM, Tamsin and Kestrel as human seats, Brother Odo as companion.
Two isolated Playwright contexts (Tamsin, Kestrel) on the Brave debug port. No source change.
Seq numbers are from the operator events route of the final 390 px run.

## T032 results

| Check | Result | Notes |
|---|---|---|
| One composer and one Send per viewer | pass | `form[aria-label=Composer]` count 1 and Send count 1, for Tamsin and Kestrel |
| Free-mode post enters the ring | pass | Post at t=0. About 2 s blank, then 8/8 segments at t=2.1 s, counting down 1 per second to 0. Caption "The DM reads the table in N s. Keep talking to wait." (talk seq 17, intent.recorded 18, presence read 19) |
| Thinking shows | pass | "The DM is reading the table…" at t=10.1 s, on both viewers |
| Send reads "Send — interrupts the DM" while Thinking | pass | Tamsin and Kestrel both show it |
| Interrupt strip offers I'm sure and Wait | pass | Send click with Thinking showing opens "Interrupt the DM?" with I'm sure and Wait. Wait keeps the draft text and closes the strip (1280 run). I'm sure sends the line (390 run, talk seq 21) |
| Confirm row buttons | pass with script deviation | The script `greyhollow-confirm` asks about Tamsin's own deed, so the confirmer is Tamsin (action.suggested seq 20). Tamsin sees "👍 Yes" and "Not quite". Kestrel sees "Waiting on Tamsin Vale". The mirrored case (Kestrel confirms, Tamsin waits) is the same code path but was not run live: no script confirms a Kestrel deed |
| Line turns "Confirmed" | pass | After Tamsin's 👍, both viewers show "Confirmed", no buttons, no "Waiting on" (intent.recorded seq 26, check.resolved 25) |
| Turn mode: no ring, "Enter commits your turn", Enter commits, no Commit button | NOT RUN | The script never starts an encounter, so the table stays in free mode. Table mode panel says "Turn mode needs an encounter. The AI DM starts one." Covered by Phase 2-3 unit tests only |
| "Asks the DM" chip | pass | `@dm how high is the loft?` shows "Asks the DM" (earlier session, script answer follows) |
| "DM aside" | pass | The script's ask_dm answer renders as "DM aside" (same session) |
| "Table talk" chip | pass | Out-of-character lines (Speaker "You (out of character)", and a parenthesis line) show "Table talk" (talk seq 29, 31, channel ooc) |
| Speaker chip has no "The party" entry | pass | Speaker options: "Tamsin Vale", "You (out of character)" |

Mention options for `hi @`: @dm, @tamsin, @odo, @kestrel.

Observation, not a bug: the Thinking status is brief (about 1 s) and a Send during it is only
possible in that window; the first check scripts missed it until polled at 50 ms.

## T033 screenshots and layout

Files in this directory: `free-mode-1280-*.png`, `free-mode-390-*.png`, `confirm-row-1280-*.png`,
`confirm-row-390-*.png`, `confirmed-*.png`, `interrupt-*.png`,
`speaker-open-*.png`, `mention-open-*.png` (suffix `-tamsin` or `-kestrel`).

- No `[role=dialog]`, `[aria-modal=true]` or open `<dialog>` at 1280 px or 390 px: pass.
- No horizontal page overflow at either width: pass.
- Speaker listbox bounding box, viewport 1280: x 252-444 (inside). Viewport 390: x 12-204 (inside): pass.
- Mention listbox bounding box, 1280: x 363-555. Viewport 390: x 123-315 (inside 390): pass.

## T034 accessibility

Accessibility tree read through CDP `Accessibility.getFullAXTree` (Playwright's `page.accessibility` is removed):

| Role | Name |
|---|---|
| form | Composer |
| button | Speaker (aria-haspopup listbox, aria-expanded) |
| listbox / option | Speaker / "Tamsin Vale", "You (out of character)" |
| textbox | Message |
| listbox / option | Mention / "@dm DM" ... |
| button | Send, then "Send — interrupts the DM" |
| group | "Interrupt the DM?" (fieldset legend, screen-reader only) with buttons "I'm sure", "Wait" |
| section | "DM confirm" with buttons "👍 Yes", "Not quite" |
| status | the ring and Thinking |

Keyboard-only pass (Tab, Shift+Tab, Enter, no mouse):

- Speaker: Shift+Tab from Message reaches Speaker. Enter opens the listbox. Tab reaches the first option. Enter chooses it and closes the list. Pass. Focus drops to `body` after choosing (not returned to Speaker). Minor finding, not fixed.
- Mention: typing `hi @` opens the list. Tab reaches the first option. Enter inserts `@dm `. Pass.
- Send: Tab from Message reaches Send. Enter submits (or opens the interrupt strip while Thinking). Pass.
- I'm sure and Wait: Tab order after Send is I'm sure, then Wait. Enter on Wait closes the strip and keeps the text. Enter on I'm sure sends. Pass.
- 👍 Yes and Not quite: Tab from Message reaches "👍 Yes" then "Not quite". Enter on 👍 Yes confirmed the line. Pass. Enter on Not quite was not exercised (it opens the editor).
- Roles and names are present on every control. Pass.

## Not run live

- Turn mode (needs an encounter; the script has none).
- Kestrel as the confirmer (the script confirms Tamsin's deed).
- Not quite editor.
