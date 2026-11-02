import type { ZodType } from "zod";
import type { ChatMessage, ErrorKind, UsageRecord } from "../../ai/types.js";
import type { DmPurpose } from "../purposes.js";
import type { ModelCallRecord, NodeDeps, NodeError } from "./context.js";

/**
 * The shared model-call helpers (contracts/node-seam.md "Model calls").
 * Each call names exactly one gateway purpose. A gateway error passes through
 * with its kind; malformed JSON gets one repair re-ask.
 */

export interface CallRequest {
  purpose: DmPurpose;
  promptVersion: string;
  system: string;
  user: string;
  signal: AbortSignal;
  /** Applied to the parsed JSON before the schema runs, on every attempt. */
  normalize?: (json: unknown) => unknown;
}

export type CallFailure = {
  ok: false;
  error: NodeError;
  calls: ModelCallRecord[];
};

export type JsonResult<T> =
  | { ok: true; value: T; calls: ModelCallRecord[] }
  | CallFailure;

export type TextResult =
  | { ok: true; text: string; calls: ModelCallRecord[] }
  | CallFailure;

type Collected =
  | {
      ok: true;
      text: string;
      outputTokens: number | null;
      usage: UsageRecord | null;
    }
  | {
      ok: false;
      kind: ErrorKind | "aborted";
      message: string;
      usage: UsageRecord | null;
    };

type CallDeps = Pick<NodeDeps, "gateway" | "recordCall"> &
  Partial<Pick<NodeDeps, "log">>;

/**
 * Ends one model attempt: builds its record from the gateway's usage record
 * (nulls when none arrived), pushes it to `calls` (an aborted attempt is not
 * pushed, as before) and hands it to the optional ledger seam.
 */
async function settle(
  deps: CallDeps,
  req: CallRequest,
  attempt: number,
  outcome: ModelCallRecord["outcome"] | "aborted",
  errorKind: ErrorKind | null,
  usage: UsageRecord | null,
  calls: ModelCallRecord[],
): Promise<void> {
  const base = {
    purpose: req.purpose,
    promptVersion: req.promptVersion,
    attempt,
    errorKind,
    provider: usage?.provider ?? null,
    model: usage?.model ?? null,
    inputTokens: usage?.inputTokens ?? null,
    outputTokens: usage?.outputTokens ?? null,
    costUsd: usage?.costUsd ?? null,
    durationMs: usage?.durationMs ?? null,
  };
  if (outcome !== "aborted") calls.push({ ...base, outcome });
  await deps.recordCall?.({
    ...base,
    outcome,
    httpAttempts: usage?.attempts ?? null,
  });
}

/** One failed model attempt, kept in an `invalid-output` detail. */
export interface AttemptExcerpt {
  attempt: 1 | 2;
  outputTokens: number | null;
  chars: number;
  issues: string;
  excerpt: string;
}

const EXCERPT_WHOLE = 8000;
const EXCERPT_HEAD = 6000;
const EXCERPT_TAIL = 2000;

/** Bounds raw model text for a failure record (contracts/failure-record.md). */
export function excerptOf(text: string): string {
  if (text.length <= EXCERPT_WHOLE) return text;
  const elided = text.length - EXCERPT_WHOLE;
  return `${text.slice(0, EXCERPT_HEAD)}\n…[${elided} characters elided]…\n${text.slice(-EXCERPT_TAIL)}`;
}

function attemptOf(
  attempt: 1 | 2,
  collected: { text: string; outputTokens: number | null },
  issues: string,
): AttemptExcerpt {
  return {
    attempt,
    outputTokens: collected.outputTokens,
    chars: collected.text.length,
    issues,
    excerpt: excerptOf(collected.text),
  };
}

const LOG_EDGE = 200;

/**
 * TASK-0203: the ledger holds no text, so a recovered first-attempt failure
 * left no trace of the reply's shape. Log head and tail (200 chars each) of
 * every unparsable reply, one line per attempt.
 */
function logInvalid(
  deps: CallDeps,
  req: CallRequest,
  attempt: 1 | 2,
  collected: { text: string; outputTokens: number | null },
  issues: string,
): void {
  const t = collected.text;
  deps.log?.({
    event: "dm.call.invalid-json",
    purpose: req.purpose,
    promptVersion: req.promptVersion,
    attempt,
    outputTokens: collected.outputTokens,
    chars: t.length,
    issues: issues.slice(0, 300),
    head: t.slice(0, LOG_EDGE),
    tail: t.length > LOG_EDGE ? t.slice(-LOG_EDGE) : "",
  });
}

async function collect(
  deps: CallDeps,
  req: CallRequest,
  messages: ChatMessage[],
): Promise<Collected> {
  let text = "";
  let outputTokens: number | null = null;
  let usage: UsageRecord | null = null;
  let failed: { kind: ErrorKind; message: string } | null = null;
  for await (const event of deps.gateway.chat({
    purpose: req.purpose,
    system: req.system,
    messages,
    signal: req.signal,
    onUsage: (r) => {
      usage = r;
    },
  })) {
    if (event.type === "text") text += event.text;
    else if (event.type === "done") outputTokens = event.usage.outputTokens;
    else if (event.type === "error") {
      failed = { kind: event.kind, message: event.message };
      // Leave the loop so the gateway's `finally` runs (and fires onUsage)
      // before the usage record is read below.
      break;
    }
  }
  if (failed) {
    return { ok: false, kind: failed.kind, message: failed.message, usage };
  }
  if (req.signal.aborted) {
    return {
      ok: false,
      kind: "aborted",
      message: "the turn was aborted",
      usage,
    };
  }
  return { ok: true, text, outputTokens, usage };
}

async function failure(
  deps: CallDeps,
  collected: Extract<Collected, { ok: false }>,
  req: CallRequest,
  attempt: number,
  calls: ModelCallRecord[],
): Promise<CallFailure> {
  if (collected.kind === "aborted") {
    await settle(deps, req, attempt, "aborted", null, collected.usage, calls);
    return {
      ok: false,
      error: { kind: "aborted", message: collected.message },
      calls,
    };
  }
  await settle(
    deps,
    req,
    attempt,
    "error",
    collected.kind,
    collected.usage,
    calls,
  );
  return {
    ok: false,
    error: {
      kind: "gateway",
      message: collected.message,
      detail: { errorKind: collected.kind, purpose: req.purpose },
    },
    calls,
  };
}

/** Strips one surrounding code fence, if the whole text is fenced. */
export function stripFence(text: string): string {
  const trimmed = text.trim();
  const m = /^```[A-Za-z0-9_-]*\s*\n([\s\S]*?)\n?```$/.exec(trimmed);
  return m ? (m[1] as string).trim() : trimmed;
}

/**
 * Strips leading `<think>…</think>` blocks a router may render as text
 * (contracts/think-strip.md). Parse order: think, then fence.
 */
export function stripThink(text: string): string {
  return text.replace(/^(?:\s*<think>[\s\S]*?<\/think>)+\s*/, "");
}

/**
 * Finds the one top-level `{…}` object in prose-wrapped text (string-aware
 * brace scan). Returns null when there is none, it is unbalanced, or a second
 * top-level object follows (ambiguous output is not accepted).
 */
export function extractObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      return text.indexOf("{", i + 1) < 0 ? text.slice(start, i + 1) : null;
    }
  }
  return null;
}

/** Strict parse first; then the single object inside surrounding prose, fences or an unclosed think block. */
function parseJsonLoose(body: string): unknown {
  try {
    return JSON.parse(stripFence(body));
  } catch (error) {
    const obj = extractObject(body);
    if (obj === null) throw error;
    try {
      return JSON.parse(obj);
    } catch {
      throw error;
    }
  }
}

function parseAgainst<T>(
  text: string,
  schema: ZodType<T>,
  normalize?: (json: unknown) => unknown,
): { ok: true; value: T } | { ok: false; issues: string } {
  let json: unknown;
  const body = stripThink(text);
  if (body.trim() === "" && body !== text) {
    return {
      ok: false,
      issues: "not valid JSON: the reply held only a think block",
    };
  }
  try {
    json = parseJsonLoose(body);
  } catch (error) {
    return { ok: false, issues: `not valid JSON: ${(error as Error).message}` };
  }
  const parsed = schema.safeParse(normalize ? normalize(json) : json);
  if (parsed.success) return { ok: true, value: parsed.data };
  const issues = parsed.error.issues
    .slice(0, 8)
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  return { ok: false, issues };
}

export async function callJson<T>(
  deps: CallDeps,
  req: CallRequest & { schema: ZodType<T> },
): Promise<JsonResult<T>> {
  const calls: ModelCallRecord[] = [];
  const messages: ChatMessage[] = [{ role: "user", content: req.user }];

  const first = await collect(deps, req, messages);
  if (!first.ok) return failure(deps, first, req, 1, calls);
  const parsedFirst = parseAgainst(first.text, req.schema, req.normalize);
  if (parsedFirst.ok) {
    await settle(deps, req, 1, "ok", null, first.usage, calls);
    return { ok: true, value: parsedFirst.value, calls };
  }
  logInvalid(deps, req, 1, first, parsedFirst.issues);
  await settle(
    deps,
    req,
    1,
    first.usage?.truncated ? "truncated" : "invalid-json",
    null,
    first.usage,
    calls,
  );

  const attempts: AttemptExcerpt[] = [attemptOf(1, first, parsedFirst.issues)];
  messages.push(
    { role: "assistant", content: first.text },
    {
      role: "user",
      content: `That output was rejected:\n${parsedFirst.issues}\nReply again with only the corrected JSON object.`,
    },
  );
  const second = await collect(deps, req, messages);
  if (!second.ok) return failure(deps, second, req, 2, calls);
  const parsedSecond = parseAgainst(second.text, req.schema, req.normalize);
  if (parsedSecond.ok) {
    await settle(deps, req, 2, "ok", null, second.usage, calls);
    return { ok: true, value: parsedSecond.value, calls };
  }
  logInvalid(deps, req, 2, second, parsedSecond.issues);
  await settle(
    deps,
    req,
    2,
    second.usage?.truncated ? "truncated" : "invalid-json",
    null,
    second.usage,
    calls,
  );
  attempts.push(attemptOf(2, second, parsedSecond.issues));
  return {
    ok: false,
    error: {
      kind: "invalid-output",
      message: `model output failed its schema twice (${req.purpose})`,
      detail: {
        purpose: req.purpose,
        promptVersion: req.promptVersion,
        issues: parsedSecond.issues,
        attempts,
      },
    },
    calls,
  };
}

/** Prose without parsing: narrate's call. */
export async function callText(
  deps: CallDeps,
  req: CallRequest,
): Promise<TextResult> {
  const calls: ModelCallRecord[] = [];
  const result = await collect(deps, req, [
    { role: "user", content: req.user },
  ]);
  if (!result.ok) return failure(deps, result, req, 1, calls);
  await settle(
    deps,
    req,
    1,
    result.usage?.truncated ? "truncated" : "ok",
    null,
    result.usage,
    calls,
  );
  return { ok: true, text: stripThink(result.text), calls };
}
