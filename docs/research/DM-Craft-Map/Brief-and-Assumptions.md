---
title: Brief and Assumptions
aliases: []
tags: [brief]
type: note
created: 2026-10-26
updated: 2026-10-26
related: [[DM-Craft-Map]]
---

# Brief and Assumptions

## Requirements (restated from the operator's request, task TASK-0115)

- Build a research-vault branch named DM-Craft-Map from three gathered inventories (books, web, project) and one SRD pass.
- This is the EMBED phase: neutral, cited, descriptive notes. No verdicts, rankings or recommendations. A later analysis does that.
- Scope: a breadth map of DM craft, used to scope later deep-dive branches.
- First planned deep dive: how a DM decides what the dice decide versus what the player decides, and how each is narrated.
- Operator's books are not open-licensed: paraphrase only, no quotations, no tables or stat blocks. Cite by heading path.
- Web entries with `read: title-only` keep only title, URL and tags. Drop any inferred "covers" text.
- Exclude any pdfcoffee.com URL and the enworld.org thread as sources. List Colville titles with no remaining URL as titles without a readable source, and record the gap.
- SRD 5.2.1 (CC-BY-4.0): heading-path citations; short attributed quotations are permitted for the SRD only.
- Record known gaps: DMG Introduction (player types) absent from the export; web depth is title-level; Colville videos unread; Lazy GM Resource Document license unconfirmed; DMG is the 2014 edition while the project baseline is SRD 5.2.1 (2024 rules), so divergences are flagged where seen.

## Assumptions

- DM craft means what a DM or GM does at the table and in preparation, including adventure-design advice. Setting lore, monster, spell and magic-item content are out of scope.
- The tag labels from the gather passes are the classification. One entry can carry several tags and can appear in several craft notes.
- Craft areas group tags (listed in [[DM-Craft-Map]]). Areas with large entry sets were split into separate notes: session zero and safety tools apart from the players-and-table note; encounter design apart from adventure design; horror apart from world and tone.
- Book entries cite heading paths from the export (nested chapter zips). The heading text is the citation.
- A title-only web entry makes no claim about the article's content. Its tags came from the title.
- The SRD pass covers only what `packages/srd/` holds. That is 15 condition records for adjudication; see [[SRD-5.2.1-Rules-Pass|SRD 5.2.1 Rules Pass]].
- The project doctrine inventory (A3) is taken at the commit pin stated in [[The-Stacks-Doctrine-Today|The Stacks Doctrine Today]].
- Counts in the matrix treat each gathered entry as one unit regardless of size.

## First planned deep dive: inputs in this branch

The planned question is how a DM decides what the dice decide versus what the player decides, and how each is narrated. The notes holding relevant entries are:

- [[Adjudication-and-Dice|Adjudication and Dice]]
- [[Narrating-Outcomes-and-Description|Narrating Outcomes and Description]]
- [[Players-Agency-and-the-Table|Players, Agency and the Table]]
- [[SRD-5.2.1-Rules-Pass|SRD 5.2.1 Rules Pass]]
- [[The-Stacks-Doctrine-Today|The Stacks Doctrine Today]]
- [[Coverage-Matrix|Coverage Matrix]]

The project operator ruling on TASK-0113 (player agency and involuntary effects) is quoted in [[The-Stacks-Doctrine-Today|The Stacks Doctrine Today]].

## Open questions

- Which source supplies the SRD 5.2.1 Playing the Game text for the deep dive: the PDF at the url in the grounding file, or another repo copy?
- Is the SRD 5.1 benchmark corpus at `apps/server/bench/retrieval/corpus/` in scope as an SRD source, given the baseline is SRD 5.2.1?
- Should the DMG Introduction (player types) be re-exported so the players-and-expectations area has the book's own text?
- Should the title-only web entries relevant to the deep dive be read in full (for example the Angry GM Declare-Determine-Describe cycle, the Alexandrian Null Result and Rolling for Riddles)?
- Do the Colville videos need transcripts from a legitimate source before the deep dive?
- What is the license of the Lazy GM's Resource Document, and may its text be reused?
- Which 2024-edition books, if any, should join the books list so the 2014 and 2024 rule texts can be compared directly?
- Does the deep dive take only the DM-side question, or also the engine-versus-model split recorded in the doctrine note?

## Grounding

- [[_grounding]] — method, sources, gaps
- [[DM-Craft-Map]] — the branch entry
