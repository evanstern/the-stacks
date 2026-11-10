// FR-033–FR-036: attempt, use_object, ruling, set_dc and the replan.
import type { Intent } from "@the-stacks/intent";
import { type Ctx, commands, type Handler, reasonOf, refuse } from "./refs.js";
import type { PlanFact, PlanResult, RulingRequest } from "./types.js";

/** `attempt` and `use_object`: the DM decides the outcome; no roll is planned (FR-033). */
export const askOutcome: Handler = (c) => ({
  kind: "needs_ruling",
  request: {
    requestId: c.askId,
    intent: c.intent,
    ask: "outcome",
    roll: null,
    opposition: null,
    stakes: c.intent.targets.some((t) => t.kind === "actor") ? "other" : "self",
    rule: null,
  },
  facts: [],
});

const withFacts = (r: PlanResult, lead: PlanFact[]): PlanResult => ({
  ...r,
  facts: [...lead, ...r.facts],
});

function open(c: Ctx, id: string): RulingRequest | PlanResult {
  return (
    c.state.openRequests[id] ??
    refuse("REQUEST_NOT_OPEN", `no open request "${id}"`, { requestId: id })
  );
}
const isRequest = (x: RulingRequest | PlanResult): x is RulingRequest =>
  "requestId" in x;

type Answer = {
  dc?: number;
  difficulty?: NonNullable<Ctx["answer"]>["difficulty"];
};

/** Accept: plan the stored Intent with the answer, or settle an `outcome` ask with no command. */
function accept(c: Ctx, req: RulingRequest, answer: Answer, lead: PlanFact[]) {
  if (req.ask === "outcome") {
    return commands([], [...lead, { kind: "no-roll", reason: "uncontested" }]);
  }
  const stored = req.intent as Intent;
  const a =
    answer.dc !== undefined
      ? { dc: answer.dc }
      : answer.difficulty !== undefined
        ? { difficulty: answer.difficulty }
        : undefined;
  return withFacts(
    c.replan({
      ...c,
      intent: stored,
      reason: reasonText(c, stored),
      askId: c.intent.id,
      ...(a ? { answer: a } : {}),
    }),
    lead,
  );
}

// The replanned commands cite the Intent they came from (FR-004), not the ruling.
const reasonText = (_c: Ctx, stored: Intent): string => reasonOf(stored);

const by = (c: Ctx): "dm" | "ai:dm" =>
  c.intent.actor.kind === "ai:dm" ? "ai:dm" : "dm";

/** `ruling`: accept, reject or amend an open request (FR-034). */
export const ruling: Handler = (c) => {
  const i = c.intent;
  if (i.kind !== "ruling") throw new Error("ruling");
  const req = open(c, i.params.requestId);
  if (!isRequest(req)) return req;
  const fact: PlanFact = {
    kind: "ruling",
    requestId: req.requestId,
    decision: i.params.decision,
    by: by(c),
    ...(i.params.reason ? { reason: i.params.reason } : {}),
  };
  if (i.params.decision === "reject") return commands([], [fact]);
  if (i.params.decision === "accept") return accept(c, req, i.params, [fact]);
  const body = i.params.amend as NonNullable<typeof i.params.amend>;
  const stored = req.intent as Intent;
  const { kind, targets, params, text } = body;
  const amended = { ...stored, kind, targets, params, text } as Intent;
  const a =
    i.params.dc !== undefined
      ? { dc: i.params.dc }
      : i.params.difficulty !== undefined
        ? { difficulty: i.params.difficulty }
        : undefined;
  return withFacts(
    c.replan({
      ...c,
      intent: amended,
      reason: reasonText(c, amended),
      askId: c.intent.id,
      ...(a ? { answer: a } : {}),
    }),
    [fact],
  );
};

/** `set_dc`: an `accept` with its `dc` or `difficulty` on `openRequests[for]` (FR-035). */
export const setDc: Handler = (c) => {
  const i = c.intent;
  if (i.kind !== "set_dc") throw new Error("set_dc");
  const req = open(c, i.params.for);
  if (!isRequest(req)) return req;
  const fact: PlanFact = {
    kind: "ruling",
    requestId: req.requestId,
    decision: "accept",
    by: by(c),
  };
  return accept(c, req, i.params, [fact]);
};
