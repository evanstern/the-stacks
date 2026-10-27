# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

This is **not a software project** — it is an Obsidian-style Markdown **thinking vault**. There is no build, test, or lint step. The "code" is knowledge: interlinked Markdown notes with YAML frontmatter.

It is a place to **think ideas out with some grounding**. Its defining discipline is a strict separation between *gathering* knowledge and *drawing conclusions* from it — so you can always tell established fact from your own reasoning. That separation is enforced by a three-phase pipeline, orchestrated by this file.

## The pipeline (this file's job is to organize it)

Knowledge moves through three phases. Each is a **separate skill that knows nothing about the others** — they compose only through the files in the vault and the verification gates between them. This file documents the flow; the skills execute their own phase.

```
   research-vault              analyze-vault                vault-artifact
      (EMBED)                    (QUERY)                      (RENDER)
 gather + wikify  ──[gate:──▶  evaluate the   ──[gate:────▶  visualize the
 the raw facts   verify_branch] corpus, form  verify_analysis] argument as a
                                a judgment                     self-contained page
        │                           │                              │
   _grounding.md                Analysis-*.md                  *-briefing.html
   + neutral notes              (opinion/verdict)              [gate: verify_artifact]
```

- **EMBED (research):** gather cited facts into `_grounding.md` and structure them into *neutral,
  descriptive* notes. Lays out **what is known** — no verdicts, no recommendations.
- **QUERY (analyze):** take a question, reason **across** the embedded corpus, and write an
  **opinionated** analysis note — a working thesis, evaluation, tradeoffs, a recommendation.
- **RENDER (artifact):** optionally turn an analysis's argument into a visual, self-contained HTML page.

The phases are **independent and gated**: analyze runs only on a branch that passes the branch
gate; render runs only on a branch that has a valid analysis. You can stop after any phase.

## The verification gates (Node, hosted in the research plugin)

The gates live in the plugin (`${CLAUDE_PLUGIN_ROOT}/gates/`), not in the vault — every vault
shares one canonical, updatable copy. This folder is marked as a vault by a `.research-vault`
sentinel at its root. Each phase runs its gate and must pass before the next phase may begin:

- `node ${CLAUDE_PLUGIN_ROOT}/gates/cli.mjs branch <vault> <Branch>` — branch is well-formed and
  analyzable (MOC, grounding, valid frontmatter, isolation holds).
- `node ${CLAUDE_PLUGIN_ROOT}/gates/cli.mjs analysis <vault> <Branch>` — a grounded
  `type: analysis` note exists.
- `node ${CLAUDE_PLUGIN_ROOT}/gates/cli.mjs artifact <artifact.html>` — the page is self-contained.

A **Stop hook** also enforces self-containment automatically: it refuses to finish while any
rendered `*.html` inside a vault would load external resources (the Artifact CSP blocks those).

## The core structural rule: one topic = one isolated branch

The vault is a tree. `Home.md` is the trunk. Every top-level folder is a **single "wiki"** — one complete branch about one topic, with **no interleaving into any other branch**.

- `RAG/`, `Agent-Loop/`, `Baseball/`, `My-Project/` are each an independent wiki.
- A note in one topic folder **must never** `[[wikilink]]` to a note in a different topic folder. Every wikilink resolves *within the same top-level folder*. This isolation is the defining constraint — do not violate it, even when two topics seem related. The branch gate enforces it.
- If work genuinely spans two topics, duplicate the relevant context into each branch rather than linking across them. Cross-topic connections live only in `Home.md`, not in links.

Folder names are `Title-Case-With-Hyphens`. The folder name is the topic's canonical identity.

## Layers within a branch

The pipeline lays down four kinds of note. Keep them distinct — never let a later layer overwrite an earlier one.

| Layer | File | `type` | Phase | Content |
|---|---|---|---|---|
| Grounding | `_grounding.md` | `source` | research | Raw, cited research. Source-of-truth. Kept close to verbatim — **never editorialized**. |
| Knowledge | `<Note>.md`, MOC | `moc` / `note` | research | Neutral notes structuring *what is known*. Cite into grounding. No verdicts. |
| Analysis | `Analysis-<Slug>.md` | `analysis` | analyze | Opinion built *across* the knowledge: thesis, evaluation, recommendation. Cites the corpus. |
| Artifact | `<slug>-briefing.html` | — | render | Visual rendering of an analysis's argument. |

The MOC ("Map of Content") is the branch's entry note, **named exactly after the folder**
(`RAG/RAG.md`). It links to every note in the branch and is what `Home.md` points at.

## Frontmatter schema

```yaml
---
title: Human Readable Title
aliases: []          # alternate names Obsidian should resolve to this note
tags: []             # lowercase, no spaces; scope tags to the topic
type: moc            # moc = entry · note = knowledge · source = grounding · analysis = evaluation
created: YYYY-MM-DD  # today's date when first written
updated: YYYY-MM-DD  # bump whenever you materially change the note
related: []          # [[wikilinks]] to sibling notes IN THIS FOLDER ONLY
---
```

Use the templates in `_templates/` rather than hand-writing frontmatter.

## Linking conventions

- Internal links use `[[Note Name]]` / `[[Note Name|display]]`, resolved **within the same branch**.
- The MOC links to every note in its folder; every note links back to the MOC (usually via `related`). No orphans.
- External sources are plain Markdown links `[label](url)`, cited where the claim is made.

## Conventions to preserve

- ISO dates (`YYYY-MM-DD`) everywhere; today's date is in session context.
- Note filenames match their `title` closely and are unique within their folder.
- Never edit or move another topic's folder while working on the current one.
- Keep the phases honest: don't slip a recommendation into a research note, and don't re-derive
  raw facts inside an analysis — cite the grounding instead.
