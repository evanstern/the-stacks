# Playtest audit — 20261026T142758Z-greyhollow-ford-provider

**Verdict: incomplete**

- Session: 61246885-6640-4c30-8f4e-48660ff4fbd9
- Seed: greyhollow-ford
- Commit: d994673dcf5c5c972e167ca53e3a854b961deb09
- Auditor mode: model
- Audited at: 2026-10-26T14:31:01.857Z

## Counts

| rows | narrations | segments | rolls | fail | warn | note |
|---|---|---|---|---|---|---|
| 31 | 3 | 4 | 1 | 3 | 0 | 1 |

## Findings

| id | severity | kind | source | segment | rows | doctrine | detail |
|---|---|---|---|---|---|---|---|
| F1 | fail | ledger-contradiction | check | 0 | 10 | - | The dice lines differ from the ledger (expected 0, found 1). |
| F2 | fail | ledger-contradiction | auditor | 1 | 11, 16 | - | Row #11 records small clawed tracks pressed into the dust, but #16 claims the dust gives up nothing, no print. |
| F3 | fail | ledger-contradiction | auditor | 1 | 11, 16 | - | #16 refers to the creak sounding "again" and the stillness "as before", but no prior creak exists anywhere in the cited rows. |
| F4 | note | dm-audit-flag | dm-audit | 1 | 16 | - | final: passed-after-regenerate; attempts: 3; issues: ledger-mismatch, player-agency, doctrine, invented-mechanics |

## Segments

| index | narration | rows | failing checks | auditor |
|---|---|---|---|---|
| 0 | 10 | 1-10 | dice-lines | pass (0 findings, 2 attempts) |
| 1 | 16 | 11-16 | none | fail (2 findings, 1 attempt) |
| 2 | 25 | 17-25 | none | error: parse |
| 3 | - | 26-31 | none | error: parse |

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

Usage: 7 calls, 37376 input tokens, 4326 output tokens, cost $0.29503.

