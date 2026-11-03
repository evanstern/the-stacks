# Deviations: spec 076

Seam check at HEAD (merged with main through TASK-0213/0211), 2026-11-03.

- Prompt versions on main are narrate-v15, audit-v10, interpret-v12, adjudicate-v9, director-v6,
  chronicle-v4. The plan names narrate-v10; this task bumps narrate to `dm.narrate-v16` instead.
- `seed/schema.ts`, `seed/views.ts`, the four seeds and the spec 031 byte copy: unchanged in shape;
  `opening` still holds only `framing`. Phase 1 applies D1 to D3 as written.
- `prompts/narrate.ts`: the `scene` array is unchanged from the plan's R1 (three lines). Rule text
  lines in `RULES` grew (TASK-0127, 0208, 0170); the opening section does not touch them.
- `nodes/narrate.ts`: `beatNpcIds` still the Director-beat expression at HEAD. D5 applies.
- Phase 2: `PROMPT_VERSION` is `dm.narrate-v16` (plan said v10).
