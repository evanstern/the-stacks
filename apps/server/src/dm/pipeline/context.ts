import type { SessionProjections } from "@the-stacks/session-model";
import type { SrdKind, SrdRecord } from "@the-stacks/srd";
import type { Gateway } from "../../ai/gateway.js";
import type { ErrorKind } from "../../ai/types.js";
import type { Gate } from "../../gate/index.js";
import type { RetrievalResult } from "../../library/retrieve.js";
import type { TurnCheckpoint, TurnTrigger } from "../jobs.js";
import type { AdjudicateOutput } from "../nodes/adjudicate.js";
import type { AssembleOutput } from "../nodes/assemble.js";
import type { AuditOutput } from "../nodes/audit.js";
import type { DirectorNodeOutput } from "../nodes/director.js";
import type { NarrateOutput } from "../nodes/narrate.js";
import type { ResolveOutput } from "../nodes/resolve.js";
import type { InterpretOutput } from "../nodes/schemas.js";
import type { DmPurpose } from "../purposes.js";
import type { SceneSeed } from "../seed/schema.js";

/**
 * The node seam (specs/031-dm-runtime contracts/node-seam.md). Every node is
 * a plain async function of one immutable `TurnContext`; the runner builds a
 * new context after each node. No framework: a `StateGraph` could wrap these
 * functions later (decision-0019).
 */

export const NODE_NAMES = [
  "assemble",
  "director",
  "interpret",
  "adjudicate",
  "resolve",
  "narrate",
  "audit",
] as const;
export type NodeName = (typeof NODE_NAMES)[number];

/** The turn job as a node sees it. */
export interface TurnJobRef {
  id: string;
  sessionId: string;
  trigger: TurnTrigger;
  triggerSeq: number | null;
  /** A companion job ended a hold: any `hold` decision is treated as `resolve`. */
  forceResolve: boolean;
  /** 1 on the first claim, higher on a reclaim. */
  attempt: number;
  claimToken: string;
  /** scene-start only: the start request's seed id and seats. */
  start?: { seedId: string; seats: Record<string, string> } | null;
}

/** `@the-stacks/srd` lookups the nodes need. Injected so tests can stub them. */
export interface SrdLookup {
  getById: <K extends SrdKind>(kind: K, id: string) => SrdRecord<K> | undefined;
  getByName: <K extends SrdKind>(
    kind: K,
    name: string,
  ) => SrdRecord<K> | undefined;
  compact: (kind: SrdKind, idOrName: string) => string | undefined;
}

export interface NodeDeps {
  gateway: Pick<Gateway, "chat">;
  /** Only `resolve` receives the real gate; every other node gets `throwingGate`. */
  gate: Pick<Gate, "submit">;
  retrieve: (q: {
    question: string;
    signal?: AbortSignal;
  }) => Promise<RetrievalResult>;
  /** The DM view of the session. */
  loadProjections: (sessionId: string) => Promise<SessionProjections>;
  srd: SrdLookup;
  /** True while this worker holds the lease. */
  fence: () => Promise<boolean>;
  /** Fenced write of the job's stage; false when fenced out. */
  setStage: (stage: NodeName) => Promise<boolean>;
  /** Fenced write of the checkpoint; false when fenced out. */
  saveCheckpoint: (c: TurnCheckpoint) => Promise<boolean>;
  newId: () => string;
  /** Structured server log; never prompt text. */
  log: (line: Record<string, unknown>) => void;
  /** ASK_MIN_SIMILARITY: the relevance floor `adjudicate` applies to retrieved passages. */
  minSimilarity: number;
}

export interface NodeOutputs {
  assemble: AssembleOutput;
  director: DirectorNodeOutput;
  interpret: InterpretOutput;
  adjudicate: AdjudicateOutput;
  resolve: ResolveOutput;
  narrate: NarrateOutput;
  audit: AuditOutput;
}

export interface TurnContext {
  readonly job: TurnJobRef;
  readonly deps: NodeDeps;
  /** Aborted on lease loss or shutdown. */
  readonly signal: AbortSignal;
  readonly seed: SceneSeed;
  /** Empty on the first attempt. */
  readonly checkpoint: TurnCheckpoint;
  /** Outputs of the nodes already run. */
  readonly results: Readonly<Partial<NodeOutputs>>;
}

export interface ModelCallRecord {
  /** Exactly one purpose per call (AC #4). */
  purpose: DmPurpose;
  promptVersion: string;
  /** 1, or 2 for the one JSON repair re-ask. */
  attempt: number;
  outcome: "ok" | "invalid-json" | "error";
  errorKind: ErrorKind | null;
}

export type NodeErrorKind =
  | "gateway" // chat() ended with an error event
  | "invalid-output" // the model's JSON failed its schema twice
  | "gate" // resolve: a non-engine gate refusal after retries
  | "fenced" // the lease was lost
  | "aborted" // the signal aborted for shutdown
  | "internal"; // a bug; logged with no prompt text

export interface NodeError {
  kind: NodeErrorKind;
  message: string;
  detail?: Record<string, unknown>;
}

export type NodeResult<N extends NodeName> =
  | { ok: true; node: N; output: NodeOutputs[N]; calls: ModelCallRecord[] }
  | { ok: false; node: N; error: NodeError; calls: ModelCallRecord[] };

export type Node<N extends NodeName> = (
  ctx: TurnContext,
) => Promise<NodeResult<N>>;

export type TurnOutcome =
  | { status: "completed"; results: NodeOutputs; calls: ModelCallRecord[] }
  | { status: "empty-beat" }
  | { status: "held"; companions: string[] }
  | {
      status: "failed";
      node: NodeName;
      error: NodeError;
      calls: ModelCallRecord[];
    };

/** The gate every node but `resolve` receives (AC #5): any call throws. */
export const throwingGate: Pick<Gate, "submit"> = {
  submit() {
    throw new Error("gate.submit is reserved for the resolve node");
  },
};

/** Narrows the injected deps to one node: only `resolve` keeps the real gate. */
export function depsFor(deps: NodeDeps, node: NodeName): NodeDeps {
  return node === "resolve" ? deps : { ...deps, gate: throwingGate };
}
