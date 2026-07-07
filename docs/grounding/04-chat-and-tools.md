# 04 — Chat Modes, Provider Layer, Memory, and Tools

## Two modes, one discipline

v3 has two chat experiences with different contracts but shared machinery (retrieval,
citation validation, records):

### Quick Ask (single-turn, no memory) — ported from v2

- Always retrieves. Answers **only** from retrieved evidence with per-sentence citations.
- All of v2's exits survive: no evidence found → honest refusal (without paying for the
  model call); invalid or unrepairable citations → refusal; markers that don't match
  admitted chunks → refusal.
- No session state; each question stands alone. This is the "look it up" mode a GM uses
  mid-session, and its strictness is the point.

### Conversations (multi-turn, with memory) — new

- Auto-saved from the first message; renamable (auto-titled initially, operator can rename).
- The model converses freely: it can summarize, compare, speculate, and draw conclusions —
  it is not forced to refuse when the corpus is silent.
- **Retrieval is a tool, not a reflex (D8).** The corpus search is exposed to the model as
  a tool; the model decides when and how often to search within a turn. Purely
  conversational turns ("so what should my players do?") don't trigger pointless searches.
- **The citation contract adapts rather than disappears:** when the model asserts facts
  drawn from retrieved chunks, those claims carry citations, and cited chunk IDs are
  validated against what retrieval actually returned in that conversation. The model may
  never fabricate a citation; it may speak uncited when it is clearly reasoning or
  opining rather than reporting the corpus. The UI should visually distinguish
  cited-from-the-books content from the model's own reasoning.

## Provider layer (D10)

Built on the **Vercel AI SDK**. Supported provider kinds: Anthropic, OpenAI, and any
OpenAI-compatible endpoint (which covers Ollama, vLLM, LM Studio, etc.). Requirements:

- Per-role model configuration as defined in doc 03; conversations can switch among
  configured chat models, and the chosen model is recorded per message (an answer's model
  identity is part of its provenance).
- Tool calling and streaming must work across all provider kinds; where a self-hosted
  model lacks reliable tool-calling, the system degrades gracefully (documented behavior,
  not silent failure — e.g., fall back to auto-retrieval for that model).
- Provider errors follow the v2 doctrine: typed, mapped to honest status codes, retried
  with backoff only where the failure is genuinely transient (rate limits), surfaced with
  scrubbed copy.

## Memory

Start simple and observable, in keeping with the "boring is a feature" principle:

- A conversation's memory is its persisted message history, windowed to fit the model's
  context (most recent turns verbatim).
- When history outgrows the window, older turns are compacted into a stored summary that
  is itself a visible, inspectable record (the operator can see what the model "remembers").
- No cross-conversation memory in v3.

Fancier memory (semantic recall over past sessions, entity memory for campaigns) is
explicitly future work — but the schema should not preclude it.

## Tools (v3 set)

Tool use is intentionally small in v3: enough to prove the loop end-to-end and be
genuinely useful, with the sandbox story fully solved.

1. **Corpus search** — the retrieval tool described above. Returns chunks with identities
   suitable for citation.
2. **Workspace read / write / list (D9)** — each conversation gets an isolated,
   server-side scratch workspace. The model can draft, revise, and persist artifacts
   across turns (encounter drafts, NPC rosters, rulings summaries, session prep docs).
   Files are listable and downloadable in the UI, size- and count-capped, path-traversal
   proof by construction (workspace root is the universe), and deleted with the
   conversation (or on a retention policy — spec decision).

Every tool invocation is recorded as an event (doc 03) and rendered in the conversation
UI as an inspectable step, not hidden.

Design the tool registry so adding a tool is additive (definition + handler + record
type), because the stated intent is to grow this set. Candidate futures, for shaping but
not building: read-full-source (open an entire ingested document past chunk boundaries),
shared campaign-notes library, dice/table utilities.

## Safety posture for tools

- Tools execute server-side with the conversation's workspace as their entire reachable
  filesystem. No tool can read app config, other conversations' workspaces, or source
  archives (corpus access goes through the retrieval tool's controlled interface).
- Tool inputs/outputs are size-capped and logged. Failures are typed and honest.
- The operator can always see, per turn, exactly which tools ran with what arguments.
