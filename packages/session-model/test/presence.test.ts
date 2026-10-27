import { describe, expect, it } from "vitest";
import { fixtureIds, presenceMarker } from "../src/fixtures/index.js";
import {
  catalogEntry,
  decodeEvent,
  PRESENCE_PURPOSES,
  PresenceRecordedV1,
  project,
  type StoredEvent,
  type Viewer,
} from "../src/index.js";

const dm: Viewer = { role: "dm" };
const ana: Viewer = { role: "player", userId: fixtureIds.playerUserId };
const A = fixtureIds.playerUserId;
const B = fixtureIds.otherPlayerUserId;

describe("presence.recorded catalog entry", () => {
  it("is a current v1 marker with visibility any", () => {
    const entry = catalogEntry("presence.recorded", 1);
    expect(entry?.kind).toBe("marker");
    expect(entry?.visibility).toBe("any");
    expect(entry?.current).toBe(true);
  });
});

describe("PresenceRecordedV1 schema", () => {
  it("accepts a sorted unique set, an empty set and an actionId", () => {
    expect(
      PresenceRecordedV1.safeParse({ present: [A, B], purpose: "director" })
        .success,
    ).toBe(true);
    expect(
      PresenceRecordedV1.safeParse({ present: [], purpose: "floor" }).success,
    ).toBe(true);
    expect(
      PresenceRecordedV1.safeParse({
        present: [A],
        purpose: "signoff",
        actionId: "act-1",
      }).success,
    ).toBe(true);
    expect([...PRESENCE_PURPOSES]).toEqual(["director", "signoff", "floor"]);
  });

  it("rejects an unsorted set", () => {
    expect(
      PresenceRecordedV1.safeParse({ present: [B, A], purpose: "director" })
        .success,
    ).toBe(false);
  });

  it("rejects a duplicate", () => {
    expect(
      PresenceRecordedV1.safeParse({ present: [A, A], purpose: "director" })
        .success,
    ).toBe(false);
  });

  it("rejects more than 64 entries", () => {
    const ids = Array.from(
      { length: 65 },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    );
    expect(
      PresenceRecordedV1.safeParse({ present: ids, purpose: "director" })
        .success,
    ).toBe(false);
    expect(
      PresenceRecordedV1.safeParse({
        present: ids.slice(0, 64),
        purpose: "director",
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown purpose and a non-uuid id", () => {
    expect(
      PresenceRecordedV1.safeParse({ present: [], purpose: "other" }).success,
    ).toBe(false);
    expect(
      PresenceRecordedV1.safeParse({ present: ["x"], purpose: "director" })
        .success,
    ).toBe(false);
  });
});

describe("presence fold", () => {
  it("starts null and keeps the latest marker with its seq", () => {
    expect(project([], dm).presence).toBeNull();
    const rows = presenceMarker.events;
    const first = project(
      rows.filter((e) => e.seq <= 2),
      dm,
    );
    expect(first.presence).toEqual({
      present: [A],
      purpose: "director",
      actionId: null,
      seq: 2,
    });
    const last = project(rows, dm);
    expect(last.presence).toEqual({
      present: [A, B],
      purpose: "director",
      actionId: null,
      seq: 4,
    });
  });

  it("carries actionId when the marker has one", () => {
    const row: StoredEvent = {
      sessionId: presenceMarker.sessionId,
      seq: 1,
      actor: "system",
      type: "presence.recorded",
      payload: { present: [A], purpose: "signoff", actionId: "act-1" },
      payloadVersion: 1,
      visibility: "public",
      ts: "2026-10-26T18:00:01.000Z",
    };
    expect(project([row], dm).presence).toEqual({
      present: [A],
      purpose: "signoff",
      actionId: "act-1",
      seq: 1,
    });
  });

  it("adds no transcript entry and no diagnostics", () => {
    const p = project(presenceMarker.events, dm);
    expect(p.transcript).toHaveLength(2);
    expect(p.transcript.every((t) => t.kind === "talk")).toBe(true);
    expect(p.ledger).toHaveLength(0);
    expect(p.diagnostics.skippedInvalid).toBe(0);
    expect(p.diagnostics.skippedUnknownType).toBe(0);
    expect(p.throughSeq).toBe(4);
  });

  it("shows the view to a player viewer", () => {
    const p = project(presenceMarker.events, ana);
    expect(p.presence?.present).toEqual([A, B]);
    expect(p.presence?.seq).toBe(4);
  });

  it("counts an invalid marker as skipped and leaves the view alone", () => {
    const bad: StoredEvent = {
      ...(presenceMarker.events[1] as StoredEvent),
      seq: 5,
      payload: { present: [B, A], purpose: "director" },
    };
    expect(decodeEvent(bad).status).toBe("invalid");
    const p = project([...presenceMarker.events, bad], dm);
    expect(p.presence?.seq).toBe(4);
    expect(p.diagnostics.skippedInvalid).toBe(1);
  });

  it("replays deterministically", () => {
    const a = project(presenceMarker.events, dm);
    const b = project([...presenceMarker.events], dm);
    expect(b).toEqual(a);
  });
});
