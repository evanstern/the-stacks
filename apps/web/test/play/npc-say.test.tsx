import { project } from "@the-stacks/session-model";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { Transcript } from "~/play/components/transcript";
import { streamItems } from "~/play/stream";
import { toTableViewModel } from "~/play/view-model";

// T018 follow-up: the gate writes npc_say talk with characterId null under the DM actor.
const sid = "00000000-0000-4000-8000-0000000000aa";
const rows = [
  {
    actor: "system",
    type: "scene.changed",
    payload: {
      reason: "start",
      before: null,
      after: {
        sceneId: "s1",
        title: "Reed camp",
        summary: "",
        location: null,
        cast: [
          { id: "mara", name: "Mara Voss", role: "scout", appearance: "lean" },
        ],
      },
    },
  },
  {
    actor: "ai:dm",
    type: "talk",
    payload: {
      text: "Keep your voice down.",
      channel: "ic",
      characterId: null,
    },
  },
  {
    actor: "ai:dm",
    type: "intent.recorded",
    payload: {
      intent: {
        id: "i1",
        kind: "npc_say",
        actor: { kind: "npc", id: "mara" },
        channel: { kind: "scene" },
        targets: [],
        params: {},
        text: "Keep your voice down.",
        source: "ai",
        commit: "confirmed",
      },
      schemaVersion: 1,
      outcome: "settled",
      batchId: null,
      facts: [],
      request: null,
      answers: null,
      stopped: null,
    },
  },
];
const events = rows.map((r, i) => ({
  sessionId: sid,
  seq: i + 1,
  payloadVersion: 1,
  visibility: "public",
  ts: `2026-10-26T18:00:0${i}.000Z`,
  ...r,
}));

test("an npc_say talk row shows the NPC's display name as a dialogue row", () => {
  const viewer = { role: "dm" } as const;
  const p = project(events, viewer);
  const vm = toTableViewModel(p, { actor: "ai:dm", proposals: [] });
  const html = renderToStaticMarkup(
    <Transcript
      items={streamItems(vm, p, viewer)}
      commands={{} as never}
      onNotQuite={() => {}}
    />,
  );
  expect(html).toContain("Mara Voss");
  expect(html).toContain('data-kind="dialogue"');
});
