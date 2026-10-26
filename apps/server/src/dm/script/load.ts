import {
  type Rng,
  type ScriptedRng,
  scriptedRng,
} from "@the-stacks/dnd5e-engine";
import type { ChatScript } from "../../ai/adapters/fake.js";
import { FakeProvider } from "../../ai/adapters/fake.js";
import type { AiConfig } from "../../ai/config.js";
import { DM_PURPOSES, type DmPurpose } from "../purposes.js";
import { type DmScript, DmScriptSchema } from "./schema.js";

/** Name of the embed purpose the scripted config declares (retrieval default). */
export const SCRIPTED_EMBED_PURPOSE = "embedding";
const PROVIDER = "scripted";
const BASE_URL = "http://fake/scripted";

export function loadDmScript(json: unknown): DmScript {
  return DmScriptSchema.parse(json);
}

export interface ScriptedDm {
  provider: FakeProvider;
  aiConfig: AiConfig;
  rng: ScriptedRng;
  gateRng: () => Rng;
  remaining(): { calls: Record<DmPurpose, number>; dice: number };
}

function toChatScript(call: DmScript["calls"][number]): ChatScript {
  const { respond, usage } = call;
  if (respond.type === "error") {
    return [
      { type: "error", kind: respond.kind, message: respond.message, usage },
    ];
  }
  const text =
    respond.type === "json" ? JSON.stringify(respond.value) : respond.value;
  return [
    { type: "text", text },
    { type: "done", usage },
  ];
}

/** A strict fake provider with purpose queues, a config naming it, and the script's dice. */
export function createScriptedDm(script: DmScript): ScriptedDm {
  const provider = new FakeProvider();
  provider.strict = true;
  for (const call of script.calls) {
    provider.scriptChatFor(call.purpose, toChatScript(call));
  }

  const aiConfig: AiConfig = {
    providers: { [PROVIDER]: { kind: "fake", baseUrl: BASE_URL } },
    purposes: {
      ...Object.fromEntries(
        DM_PURPOSES.map((p) => [
          p,
          { provider: PROVIDER, model: "scripted-chat", op: "chat" as const },
        ]),
      ),
      [SCRIPTED_EMBED_PURPOSE]: {
        provider: PROVIDER,
        model: "scripted-embed",
        op: "embed" as const,
      },
    },
    prices: {},
  };

  const rng = scriptedRng(script.dice);
  return {
    provider,
    aiConfig,
    rng,
    gateRng: () => rng,
    remaining() {
      const calls = Object.fromEntries(
        DM_PURPOSES.map((p) => [p, provider.pendingFor(p)]),
      ) as Record<DmPurpose, number>;
      return { calls, dice: rng.remaining() };
    },
  };
}
