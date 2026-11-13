export type Segment = { kind: "prose" | "dialogue"; text: string };

/*
 * ponytail: copied from apps/server/src/playtest/auditor/checks.ts and
 * apps/server/src/dm/fact-sheet.ts (web cannot import server code). A shared home is spec 091
 * OQ-A5 / TASK-0331; until then keep these in step by hand.
 */
const DICE_LINE =
  /→|: auto-fail| death saves: \d|: \S.* (?:applied|removed)$| spends a level \d+ spell slot$| helps .+ \((?:attack|ability check)\)$|: refused, .+ \([A-Z_]+\)$/;
const WHY_LINE =
  /^(?:Rule: |DC \d+|Difficulty: |Opposed by |Reach: |DM ruling: |No roll needed$|The DM sets the )|(?: joins the fight| may react as the mover leaves)$/;
const STATE_LINE = /^State: /;
const REFUSAL_ROW = /: refused, .+ \([A-Z_]+\)$/;
const PIECE_SPLIT = /(?<=[.!?]["'”’)]*)\s+/;
const QUOTED = /"[^"]*"|“[^”]*”/;

/**
 * Narration text as prose segments and rules lines (spec 091 DA2). The trailing code block
 * (the last blank-line block whose every line is a dice, change, why, refusal or State line)
 * is dropped except its why, refusal and State lines; the ledger shows the rest. Text with no
 * such block renders whole. A sentence holding a quoted span is a `dialogue` segment.
 */
export function narrationRows(text: string): {
  prose: Segment[];
  rules: string[];
} {
  let prose = text;
  let rules: string[] = [];
  const trimmed = text.replace(/\s+$/, "");
  const i = trimmed.search(/\n\s*\n(?![\s\S]*\n\s*\n)/);
  if (i !== -1) {
    const lines = trimmed
      .slice(i)
      .replace(/^\s+/, "")
      .split("\n")
      .filter((l) => l.trim() !== "");
    if (
      lines.length > 0 &&
      lines.every(
        (l) => STATE_LINE.test(l) || WHY_LINE.test(l) || DICE_LINE.test(l),
      )
    ) {
      prose = trimmed.slice(0, i);
      rules = lines.filter(
        (l) => STATE_LINE.test(l) || WHY_LINE.test(l) || REFUSAL_ROW.test(l),
      );
    }
  }
  const segments: Segment[] = prose
    .split(PIECE_SPLIT)
    .filter((s) => s.trim() !== "")
    .map((s) => ({
      kind: QUOTED.test(s) ? "dialogue" : "prose",
      text: s,
    }));
  return { prose: segments, rules };
}
