# Implementation Plan: Kimi model tier

**Spec**: `specs/123-kimi-model-tier/spec.md` | **Card**: TASK-0360

Config-only change. Add the `kimi` entry to `.claude/model-tiers.json`; run `node <pdlc>/scripts/tiers.mjs --root .` to generate `.claude/agents/kimi-implementer.md`; `--check` must exit 0. No code, no dependency, no migration.

## Evidence (2026-11-27)
- 9router `/v1/models`: `kimi/kimi-for-coding` contextWindow 262144, maxOutput 65536, reasoning, thinking cannot be disabled (`thinkingFormat: kimi`).
- Direct `POST /v1/chat/completions` model `kimi/kimi-for-coding`, max_tokens 4000: response `model: "kimi-for-coding"`, content correct, 26 of 47 completion tokens were `reasoning_content`; finish_reason `stop`, no truncation. Thinking tokens count against max_tokens, so small caps can truncate (TASK-0181/0192/0203).
- Claude-harness dispatch (`claude -p --model kimi/kimi-for-coding`, and `ANTHROPIC_MODEL=`): `modelUsage` showed only `cc/claude-sonnet-5-5`. The harness remaps the model, so the receipt cannot prove kimi. The `kimi-implementer` agent type is also not registered mid-session (agents load at session start).
