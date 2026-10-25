---
id: decision-0012
title: 'D4 Structured mechanics: SRD 5.2.1 baseline plus extraction from imports'
date: '2026-10-25'
status: accepted
---
## Context

The engine (decision-0017) needs structured mechanics (monsters, spells, classes, equipment,
conditions) to resolve anything. Vision said "we ship no rulebooks", and constitution VIII
said the project ships no rulebook content. Imported books are prose with citations, not
structured records. Wizards of the Coast publishes the System Reference Document 5.2.1
under Creative Commons Attribution 4.0.

## Decision

- **Baseline:** ship SRD 5.2.1 structured data (monsters, spells, classes, equipment,
  conditions) so the engine works on day one with no import. Card: TASK-0043.
- **License:** SRD 5.2.1 is CC-BY-4.0. Include its required attribution statement exactly as
  its Legal Information page gives it, and add no other attribution to Wizards (the page asks
  for none). Verified against the SRD 5.2.1 PDF (media.dndbeyond.com, SRD_CC_v5.2.1.pdf,
  page 1) on 2026-10-25.
- **Imports:** later, extract stat blocks and spells from the operator's DDB imports into the
  same structured records, layered over the SRD (M5). Extracted records stay in the
  operator's database volume, like the books they come from.
- **Posture amended:** "we ship no rulebooks" becomes "we ship only openly licensed SRD data,
  with attribution; never proprietary content."

**Rationale.** An engine with no data cannot demo. The SRD is the only 5e rules data we may
lawfully ship, and its license is permissive with one attribution duty. Layering imports
over the same record shape keeps one engine path for both.

**Version note.** The session named "SRD 5.2". The current published release is 5.2.1, also
CC-BY-4.0; this record pins 5.2.1 because its attribution statement is the one verified.

## Consequences

- Supersedes vision's "We ship no rulebooks" posture line.
- Amends constitution Principle VIII (constitution 2.0.0): openly licensed SRD data with
  attribution is permitted; proprietary content stays forbidden. VIII stays NON-NEGOTIABLE.
- A test guards the attribution file (TASK-0043).
- M5 Imported Mechanics carries the extraction work.
