# Live check: talk triggers (spec 065, T032, plan D8)

Stack `stacks-task-0180` at http://localhost:3180, app rebuilt from this branch,
`DM_FAKE_SCRIPT=greyhollow-talk` (boot line: `DM script mode: greyhollow-talk (6 calls, 0 dice)`).
Browser: Brave (Playwright, `shoot-live.mjs`). Scene `greyhollow-ford`, started by spec 053's `start-scene.mjs`.
Operator account is a generated test value kept outside the repo. Run session: `2c194546-2fa4-4f3a-b296-a96a5bc3d0f9`.
`talk.mjs` posted Odo's run-2 line as public IC talk.

| Check | Result |
|---|---|
| Wenna's reply is an `ai:dm` narration row: "Wenna wipes her hands on her apron. "Folk go missing at the ford, aye. Ask the old water, not me." Her eyes slide toward the back room." | PASS |
| Debug page: turn job, trigger `talk`, succeeded, shipped | PASS |
| Talk result (debug jobs API, `talk-result.json`): outcome `reply`, code trigger `addressed: wenna`, model trigger `addressed: wenna`, reason recorded | PASS |
| No dice line on the table | PASS |
| Table still in free mode (no initiative, round or end-turn UI) | PASS |
| Shots at 1280 and 390 px, light and dark (`shots/`): table, debug; no modal in any of the 8 | PASS |

Notes: the first run failed only on driver assertions (`talk.mjs` exited on the replayed scene-start narration; the debug page
does not render the talk result object, so the check reads the jobs API it uses). Both were fixed in the scripts; this run is the record.
No product defect in the live path. The reclaim test found one defect earlier (commit c2e6d785): a reclaimed
escalation read no posts because the mode was already `turn`. Fixed in `talk-turn.ts`.
Text captures: `table-text.txt`, `debug-page.txt`.
