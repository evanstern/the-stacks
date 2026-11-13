---
id: TASK-0329
title: 'Build: Intent pills in the composer (spec 091 part 2)'
status: To Do
assignee: []
created_date: '2026-11-13T14:27:00Z'
labels:
  - web
  - ux
  - ws:table-ux
milestone: m-10
dependencies:
  - TASK-0247
ordinal: 313000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Split from TASK-0247 by the operator's C-AMD ruling 2026-11-13 ("Approve all", spec 091 OQ-A1). Builds the pill half of the amended spec 091 (specs/091-mud-stream-and-composer, amendment 2026-11): the Intent pill at commit draft with PARSE_* wording, draft(seed: Intent | string), the / verb dropdown and /?, Tab completion, the Send resolver, history of own Intents, keep-until-echo, glossary, noun expansions and way buttons. Folds in TASK-0318 (OQ-A12). Cites the spec 091 amendment; no second C-AMD. UI: no modals.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Clicking a noun or way drafts an Intent pill at draft state; nothing is sent until the player sends it (TASK-0247 AC #2).
- [ ] #2 Slash commands parse through the N-01 text grammar to Intents, shown as a pill with Tab completion and inline PARSE_* wording, with a test (TASK-0247 AC #3, narrowed by spec 066 OQ-3).
- [ ] #3 The composer keeps a line's draft until its echo lands, with a test (TASK-0247 AC #6).
- [ ] #4 Nouns, ways and Tab completion draft Intent pills per the spec 091 amendment (TASK-0247 AC #1).
- [ ] #5 The shared listbox returns focus to its trigger after a keyboard pick; the Speaker listbox follows the same rule, one test each (TASK-0318, OQ-A12).
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
