# Playtest audit — 20261026T144244Z-greyhollow-ford-provider

**Verdict: fail**

- Session: b1314ebc-6dae-4fca-90a7-82d61b22cb88
- Seed: greyhollow-ford
- Commit: 565e0860374cf97a8dfcc45f1df8928daf9c503b
- Auditor mode: model
- Audited at: 2026-10-26T14:44:46.119Z

## Counts

| rows | narrations | segments | rolls | fail | warn | note |
|---|---|---|---|---|---|---|
| 24 | 2 | 3 | 0 | 1 | 4 | 1 |

## Findings

| id | severity | kind | source | segment | rows | doctrine | detail |
|---|---|---|---|---|---|---|---|
| F1 | fail | ledger-contradiction | check | 0 | 10 | - | The dice lines differ from the ledger (expected 0, found 2). |
| F2 | warn | doctrine | auditor | 0 | 10 | hero-is-theirs | "holding its breath to match yours" assigns the hero a held breath, deciding the hero's physical reaction for the player. |
| F3 | warn | doctrine | auditor | 1 | 13, 16, 17 | fail-forward | The resolved search produces "nothing changes" — a dead stall with no new problem, despite the clock advancing at #15. |
| F4 | warn | doctrine | auditor | 1 | 17 | end-on-demand | The turn ends on a flat non-event that demands no response from the player. |
| F5 | warn | doctrine | auditor | 1 | 17 | one-sense | The beat offers no vivid non-visual detail, only an abstract statement of the outcome. |
| F6 | note | dm-audit-flag | dm-audit | 1 | 17 | - | final: fallback; attempts: 3; issues: ledger-mismatch, player-agency, doctrine |

## Segments

| index | narration | rows | failing checks | auditor |
|---|---|---|---|---|
| 0 | 10 | 1-10 | dice-lines | fail (1 findings, 2 attempts) |
| 1 | 17 | 11-17 | none | fail (3 findings, 1 attempt) |
| 2 | - | 18-24 | none | pass (0 findings, 1 attempt) |

## Fight statistics

Turn mode never began.

## Models and usage

- answering: claude / cc/claude-sonnet-5
- embedding: ollama / bge-m3
- dm.director: claude / cc/claude-opus-5
- dm.interpret: claude / cc/claude-sonnet-5
- dm.adjudicate: claude / cc/claude-opus-5
- dm.narrate: claude / cc/claude-sonnet-5
- dm.audit: claude / cc/claude-haiku-4-5-20251001
- dm.chronicle: claude / cc/claude-haiku-4-5-20251001
- dm.companion: claude / cc/claude-sonnet-5
- playtest.audit: claude / cc/claude-opus-5

Usage: 4 calls, 20876 input tokens, 2174 output tokens, cost $0.15873.

