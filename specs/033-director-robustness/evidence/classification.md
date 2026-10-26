# Classification: captured director failure (TASK-0102, T012)

**Evidence**: `capture-20261026T150925Z-greyhollow-ford-provider/` and
`apps/server/test/dm/fixtures/director-capture-20261026T150925Z-greyhollow-ford-provider.json`.
Composite `15f15fe` (origin/task-0048-playtest `639a94c` + this branch at `af9693c`).
Provider `claude`, model `cc/claude-opus-5`, `dm.director` maxTokens 1500, prompt
`dm.director-v1`.

**Run**: 12 turn jobs succeeded, 5 moves committed. That is past turns 3–4, where runs 2 and 4
stalled. The 13th turn job (triggerSeq 114, `action.committed` pt-5, in the reed-camp fight with
Tamsin at 0 HP) failed `stopped at director: invalid-output`. Spend $2.82 over 121 calls, under
the $22 ceiling.

## Attempts

| Attempt | outputTokens | chars | Issues |
|---|---|---|---|
| 1 | 783 | 584 | `goalNote: Too big: expected string to have <=300 characters` |
| 2 | 245 | 526 | `goalNote: Too big: expected string to have <=300 characters` |

Both excerpts are one bare JSON object: no prose, no fence, no reasoning block, no repeat. Every
field except `goalNote` is valid: `beat` resolve, `tableMode` stay, `trackers` [], `scene`
continue, `pacing` {tension high, spotlight `kestrel`, beatId `reed-camp`}, `companionPrompts`
[`kestrel`]. The `goalNote` values are 367 and 309 characters (measured from the fixture). The
re-ask carried the issue text, and the model shortened the note but stayed 9 characters over
the cap.

## Selected rows

- **C4 — prose over its cap.** Selected: the record shows `Too big` on `goalNote` in both
  attempts, and that is the only issue. Fix: `normalizeDirector` in `nodes/director.ts` cuts
  `goalNote` (and each `reason`) to 300 characters at the last space before the cap, then trims.
  The `normalize` hook on `callJson` carries it, and only the director passes it. Tests: the
  catalog's over-cap goalNote, over-cap reason and no-space string, plus T015 (both captured
  attempts pass `callJson` with `normalize` and `legalizeDirector` accepts the value), plus the
  T016 no-number table test.

## Rows not selected

| Row | Why not |
|---|---|
| C1 prose / fence / reasoning around JSON | Both excerpts are bare JSON. No `not valid JSON` issue. |
| C2 truncation | 783 and 245 output tokens against a 1500 cap; both objects close. |
| C3 "no change" as null / string / omitted | Every decision field is present and well-formed. |
| C5 pacing hint format | `spotlight` `kestrel` and `beatId` `reed-camp` pass. No pacing issue. |
| C6 enum drift | No `Invalid option` issue. |
| C7 payload variant missing a field | No issue inside `beat`, `tableMode` or `scene`. |
| C8 number drift | `trackers` is empty. No `advance` issue. |
| C9 streaming concatenation | The JSON appears once; no reasoning text. |

No prompt row is selected, so `PROMPT_VERSION` stays `dm.director-v1` (FR-015 applies only to
a prompt change). T015 uses the fixed-pipeline form, not the prompt-snapshot form.

## Not evidence

Runs 2 and 4 failed before Phase 1, and their issues were not persisted. Run 4's 962-token
first attempt fits a long `goalNote`, but that is a reading, not evidence. Phase 4 decides it:
the verification run must get past this turn and the run 2/4 turns with no director
`invalid-output`. A failure with a different cause there becomes a second fixture and an
operator ruling (T020).
