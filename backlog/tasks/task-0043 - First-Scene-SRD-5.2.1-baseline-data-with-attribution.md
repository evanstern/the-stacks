---
id: TASK-0043
title: 'First Scene: SRD 5.2.1 baseline data with attribution'
status: To Do
assignee: []
created_date: '2026-10-25 19:59'
labels:
  - first-scene
  - srd
  - data
milestone: m-2
dependencies:
  - TASK-0041
references:
  - 'https://www.dndbeyond.com/srd'
priority: high
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the engine works on day one with no imported book. The repo ships structured SRD 5.2.1 records (monsters, spells, classes, equipment, conditions), a loader, and compact lookup records of about 100 tokens each.

Why: decision-0012 sets the SRD as the mechanics baseline. Imports layer over it later (M5). Compact records keep prompts small: the model never loads a whole data file (decision-0021 idea 7).

License: SRD 5.2.1 is CC-BY-4.0. Its legal page requires one exact attribution statement and asks for no other attribution to Wizards. Verified against the SRD 5.2.1 PDF on 2026-10-25. The spec names the data source (transcription or an existing CC-BY dataset) and that source's own license.

Runs in parallel with the engine card. It depends on nothing else.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The repo ships SRD 5.2.1 monsters, spells, classes, equipment and conditions as Zod-validated records.
- [ ] #2 An attribution file carries the exact SRD 5.2.1 CC-BY-4.0 statement, and the app shows it on an about or legal surface.
- [ ] #3 The spec records the data source and its license.
- [ ] #4 A loader returns typed records by id and by name.
- [ ] #5 Each record has a compact lookup form of about 100 tokens, and a test enforces the size bound.
- [ ] #6 A test fails when the attribution file is missing or a record lacks a source reference.
- [ ] #7 The data contains no content from outside SRD 5.2.1.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
