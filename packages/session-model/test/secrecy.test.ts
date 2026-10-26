import { describe, expect, it } from "vitest";
import { fixtures } from "../src/fixtures/index.js";
import { project, type Viewer } from "../src/index.js";
import {
  makeRows,
  PLAYER_A,
  PLAYER_B,
  richSpecs,
  row,
  tracker,
} from "./helpers.js";

const players: Viewer[] = [
  { role: "player", userId: PLAYER_A },
  { role: "player", userId: PLAYER_B },
];

describe("secret trackers never reach players (AC #5)", () => {
  const rows = makeRows(richSpecs());

  it("the DM sees the tracker, the dm roll and the dm journal entry", () => {
    const p = project(rows, { role: "dm" });
    expect(p.trackers.map((t) => t.trackerId)).toEqual(["ritual"]);
    expect(
      p.ledger.some(
        (l) => l.kind === "roll" && l.reason === "secret hidden reason",
      ),
    ).toBe(true);
    expect(p.journal.some((j) => j.title === "DM secret title")).toBe(true);
    expect(
      p.ledger.some((l) => l.kind === "change" && l.type === "tracker.changed"),
    ).toBe(true);
  });

  for (const viewer of players) {
    it(`player ${viewer.role === "player" ? viewer.userId.slice(0, 4) : ""} gets none of it`, () => {
      const p = project(rows, viewer);
      expect(p.trackers).toEqual([]);
      const json = JSON.stringify(p);
      expect(json).not.toContain(tracker.trackerId);
      expect(json).not.toContain(tracker.name);
      expect(json).not.toContain("secret hidden reason");
      expect(json).not.toContain("DM secret title");
      expect(json).not.toContain("alarm bell");
      expect(
        p.ledger.some(
          (l) => l.kind === "change" && l.type === "tracker.changed",
        ),
      ).toBe(false);
      expect(p.journal.map((j) => j.entryId)).toEqual(["j-pub"]);
    });
  }

  it("a tracker.changed mislabelled public is still absent for players", () => {
    const leak = row(
      "tracker.changed",
      {
        reason: "oops",
        trackerId: "ritual",
        before: null,
        after: { ...tracker, note: "SECRET NOTE" },
      },
      { visibility: "public" },
    );
    for (const viewer of players) {
      const p = project([leak], viewer);
      expect(p.trackers).toEqual([]);
      expect(JSON.stringify(p)).not.toContain("SECRET NOTE");
      expect(p.throughSeq).toBe(0);
    }
    expect(project([leak], { role: "dm" }).trackers).toHaveLength(1);
  });

  it("player diagnostics do not change when hidden events are added", () => {
    const publicOnly = rows.filter((r) => r.visibility === "public");
    for (const viewer of players) {
      const withHidden = project(rows, viewer);
      const without = project(publicOnly, viewer);
      expect(withHidden.diagnostics).toEqual(without.diagnostics);
    }
  });

  it("proposal ids and bodies never reach players", () => {
    const withProposals = makeRows([
      ...richSpecs(),
      {
        type: "proposal.created",
        payload: {
          proposalId: "prop-secret-id",
          policy: "ask",
          proposal: {
            kind: "narration",
            summary: "PROPOSAL SUMMARY",
            rationale: "PROPOSAL RATIONALE",
            narration: { text: "PROPOSAL BODY", actionIds: [] },
            visibility: "public",
          },
        },
        opts: { visibility: "dm" },
      },
      {
        type: "proposal.approved",
        payload: { proposalId: "prop-secret-id", batchId: null },
        opts: { visibility: "dm" },
      },
    ]);
    expect(project(withProposals, { role: "dm" }).proposals).toHaveLength(1);
    for (const viewer of players) {
      const p = project(withProposals, viewer);
      expect(p.proposals).toEqual([]);
      const json = JSON.stringify(p);
      for (const text of [
        "prop-secret-id",
        "PROPOSAL SUMMARY",
        "PROPOSAL RATIONALE",
        "PROPOSAL BODY",
      ]) {
        expect(json).not.toContain(text);
      }
    }
  });

  it("a whisper reaches only its addressee", () => {
    const whisper = row(
      "talk",
      { text: "psst", channel: "ic", characterId: null },
      { visibility: PLAYER_A },
    );
    expect(project([whisper], players[0] as Viewer).transcript).toHaveLength(1);
    expect(project([whisper], players[1] as Viewer).transcript).toHaveLength(0);
  });
});

const uid = (v: Viewer) => (v.role === "player" ? v.userId : "");

describe("secrecy over every fixture (AC #5)", () => {
  for (const f of fixtures) {
    for (const viewer of f.viewers.players) {
      const who = viewer.role === "player" ? viewer.userId.slice(-1) : "dm";
      it(`${f.name}: player ${who} sees no tracker and no dm row`, () => {
        const p = project(f.events, viewer);
        expect(p.trackers).toEqual([]);
        expect(
          p.ledger.some(
            (l) => l.kind === "change" && l.type === "tracker.changed",
          ),
        ).toBe(false);
        expect(p.proposals).toEqual([]);
        expect(p.ledger.every((l) => l.visibility !== "dm")).toBe(true);
        expect(p.journal.every((j) => j.visibility !== "dm")).toBe(true);
        expect(p.transcript.every((t) => t.visibility !== "dm")).toBe(true);
        const hidden = f.events.filter(
          (e) =>
            e.visibility === "dm" ||
            (e.visibility !== "public" && e.visibility !== uid(viewer)) ||
            e.type === "tracker.changed" ||
            e.type.startsWith("proposal."),
        );
        const json = JSON.stringify(p);
        for (const e of hidden) {
          const reason = (e.payload as { reason?: unknown } | null)?.reason;
          const inner = (e.payload as { event?: { reason?: string } } | null)
            ?.event?.reason;
          for (const text of [reason, inner]) {
            if (typeof text === "string") expect(json).not.toContain(text);
          }
        }
      });

      it(`${f.name}: player ${who} diagnostics ignore hidden events`, () => {
        const visible = f.events.filter(
          (e) => e.visibility === "public" || e.visibility === uid(viewer),
        );
        const withoutTrackers = visible.filter(
          (e) =>
            e.type !== "tracker.changed" && !e.type.startsWith("proposal."),
        );
        expect(project(f.events, viewer).diagnostics).toEqual(
          project(withoutTrackers, viewer).diagnostics,
        );
      });
    }
  }
});
