import type { ZodType } from "zod";
import type { ChatMessage, ErrorKind } from "../../ai/types.js";
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
  | { ok: true; text: string }
  | { ok: false; kind: ErrorKind | "aborted"; message: string };

async function collect(
  deps: Pick<NodeDeps, "gateway">,
  req: CallRequest,
  messages: ChatMessage[],
): Promise<Collected> {
  let text = "";
  for await (const event of deps.gateway.chat({
    purpose: req.purpose,
    system: req.system,
    messages,
    signal: req.signal,
  })) {
    if (event.type === "text") text += event.text;
    else if (event.type === "error") {
      return { ok: false, kind: event.kind, message: event.message };
    }
  }
  if (req.signal.aborted) {
    return { ok: false, kind: "aborted", message: "the turn was aborted" };
  }
  return { ok: true, text };
}

function failure(
  collected: Extract<Collected, { ok: false }>,
  req: CallRequest,
  attempt: number,
  calls: ModelCallRecord[],
): CallFailure {
  if (collected.kind === "aborted") {
    return {
      ok: false,
      error: { kind: "aborted", message: collected.message },
      calls,
    };
  }
  calls.push({
    purpose: req.purpose,
    promptVersion: req.promptVersion,
    attempt,
    outcome: "error",
    errorKind: collected.kind,
  });
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

function parseAgainst<T>(
  text: string,
  schema: ZodType<T>,
): { ok: true; value: T } | { ok: false; issues: string } {
  let json: unknown;
  try {
    json = JSON.parse(stripFence(text));
  } catch (error) {
    return { ok: false, issues: `not valid JSON: ${(error as Error).message}` };
  }
  const parsed = schema.safeParse(json);
  if (parsed.success) return { ok: true, value: parsed.data };
  const issues = parsed.error.issues
    .slice(0, 8)
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  return { ok: false, issues };
}

export async function callJson<T>(
  deps: Pick<NodeDeps, "gateway">,
  req: CallRequest & { schema: ZodType<T> },
): Promise<JsonResult<T>> {
  const calls: ModelCallRecord[] = [];
  const messages: ChatMessage[] = [{ role: "user", content: req.user }];

  const first = await collect(deps, req, messages);
  if (!first.ok) return failure(first, req, 1, calls);
  const parsedFirst = parseAgainst(first.text, req.schema);
  if (parsedFirst.ok) {
    calls.push({
      purpose: req.purpose,
      promptVersion: req.promptVersion,
      attempt: 1,
      outcome: "ok",
      errorKind: null,
    });
    return { ok: true, value: parsedFirst.value, calls };
  }
  calls.push({
    purpose: req.purpose,
    promptVersion: req.promptVersion,
    attempt: 1,
    outcome: "invalid-json",
    errorKind: null,
  });

  messages.push(
    { role: "assistant", content: first.text },
    {
      role: "user",
      content: `That output was rejected:\n${parsedFirst.issues}\nReply again with only the corrected JSON object.`,
    },
  );
  const second = await collect(deps, req, messages);
  if (!second.ok) return failure(second, req, 2, calls);
  const parsedSecond = parseAgainst(second.text, req.schema);
  if (parsedSecond.ok) {
    calls.push({
      purpose: req.purpose,
      promptVersion: req.promptVersion,
      attempt: 2,
      outcome: "ok",
      errorKind: null,
    });
    return { ok: true, value: parsedSecond.value, calls };
  }
  calls.push({
    purpose: req.purpose,
    promptVersion: req.promptVersion,
    attempt: 2,
    outcome: "invalid-json",
    errorKind: null,
  });
  return {
    ok: false,
    error: {
      kind: "invalid-output",
      message: `model output failed its schema twice (${req.purpose})`,
      detail: { purpose: req.purpose, issues: parsedSecond.issues },
    },
    calls,
  };
}

/** Prose without parsing: narrate's call. */
export async function callText(
  deps: Pick<NodeDeps, "gateway">,
  req: CallRequest,
): Promise<TextResult> {
  const calls: ModelCallRecord[] = [];
  const result = await collect(deps, req, [
    { role: "user", content: req.user },
  ]);
  if (!result.ok) return failure(result, req, 1, calls);
  calls.push({
    purpose: req.purpose,
    promptVersion: req.promptVersion,
    attempt: 1,
    outcome: "ok",
    errorKind: null,
  });
  return { ok: true, text: result.text, calls };
}
