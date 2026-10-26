import { emptyState, evolve } from "@the-stacks/dnd5e-engine";
import {
  decodeEvent,
  type MechanicsEvent,
  type SessionEvent,
} from "../catalog.js";
import type { StoredEvent } from "../stored-event.js";
import { canSee, type Viewer } from "../visibility.js";
import { applyLifecycle, transcriptEntry } from "./actions.js";
import { buildEncounter } from "./encounter.js";
import { mechanicsRow, sessionChangeRow } from "./ledger.js";
import { changeMember, joinParty, memberOf } from "./party.js";
import type { Diagnostics, SessionProjections } from "./types.js";

export function emptyProjections(viewer: Viewer): SessionProjections {
  return {
    v: 1,
    viewer,
    scene: null,
    tableMode: { mode: "free" },
    party: [],
    encounter: null,
    journal: [],
    transcript: [],
    actions: [],
    ledger: [],
    trackers: [],
    engine: emptyState(),
    throughSeq: 0,
    diagnostics: {
      skippedUnknownType: 0,
      skippedUnknownVersion: 0,
      skippedInvalid: 0,
      outOfOrder: 0,
      ignoredTransitions: 0,
      beforeMismatches: 0,
      engineRejected: 0,
      incompleteBatches: [],
    },
    pendingBatches: {},
  };
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every(
    (k) =>
      Object.hasOwn(b, k) &&
      deepEqual(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
      ),
  );
}

function bump(
  p: SessionProjections,
  key: Exclude<keyof Diagnostics, "incompleteBatches">,
): SessionProjections {
  return {
    ...p,
    diagnostics: { ...p.diagnostics, [key]: p.diagnostics[key] + 1 },
  };
}

function checkBefore(
  p: SessionProjections,
  projected: unknown,
  before: unknown,
): SessionProjections {
  return deepEqual(projected, before) ? p : bump(p, "beforeMismatches");
}

function applyMechanics(
  p: SessionProjections,
  event: MechanicsEvent,
): SessionProjections {
  const { batchId, count } = event.payload;
  let next: SessionProjections = p;

  // Defensive batch completeness tracking.
  const pending = { ...p.pendingBatches };
  const seen = (pending[batchId]?.seen ?? 0) + 1;
  let incomplete = p.diagnostics.incompleteBatches.filter((b) => b !== batchId);
  if (seen >= count) {
    delete pending[batchId];
  } else {
    pending[batchId] = { seen, count };
    incomplete = [...incomplete, batchId];
  }
  next = {
    ...next,
    pendingBatches: pending,
    diagnostics: { ...next.diagnostics, incompleteBatches: incomplete },
  };

  // Engine fold: the engine's evolve, never a recomputed rule.
  let engine = next.engine;
  try {
    engine = evolve(next.engine, event.payload.event);
  } catch {
    next = bump(next, "engineRejected");
  }
  const party = joinParty(next.party, engine);
  return {
    ...next,
    engine,
    party,
    encounter: buildEncounter(engine, party),
    ledger: [...next.ledger, mechanicsRow(event)],
  };
}

function applyKnown(
  p: SessionProjections,
  event: SessionEvent,
): SessionProjections {
  switch (event.type) {
    case "talk":
    case "narration":
      return { ...p, transcript: [...p.transcript, transcriptEntry(event)] };
    case "action.declared":
    case "action.commented":
    case "action.committed":
    case "action.resolved": {
      const result = applyLifecycle(p.actions, event);
      const next = {
        ...p,
        actions: result.actions,
        transcript: [...p.transcript, transcriptEntry(event)],
      };
      return result.ignored ? bump(next, "ignoredTransitions") : next;
    }
    case "table-mode.changed": {
      const checked = checkBefore(p, p.tableMode, event.payload.before);
      return {
        ...checked,
        tableMode: event.payload.after,
        ledger: [...p.ledger, sessionChangeRow(event)],
      };
    }
    case "scene.changed": {
      const checked = checkBefore(p, p.scene, event.payload.before);
      return {
        ...checked,
        scene: event.payload.after,
        ledger: [...p.ledger, sessionChangeRow(event)],
      };
    }
    case "party.member.changed": {
      const checked = checkBefore(
        p,
        memberOf(p.party, event.payload.characterId),
        event.payload.before,
      );
      const party = changeMember(
        p.party,
        event.payload.characterId,
        event.payload.after,
        p.engine,
      );
      return {
        ...checked,
        party,
        encounter: buildEncounter(p.engine, party),
        ledger: [...p.ledger, sessionChangeRow(event)],
      };
    }
    case "tracker.changed": {
      if (p.viewer.role !== "dm") return p;
      const current =
        p.trackers.find((t) => t.trackerId === event.payload.trackerId) ?? null;
      const checked = checkBefore(p, current, event.payload.before);
      const after = event.payload.after;
      let trackers = p.trackers;
      if (after === null) {
        trackers = p.trackers.filter(
          (t) => t.trackerId !== event.payload.trackerId,
        );
      } else if (current) {
        trackers = p.trackers.map((t) => (t === current ? after : t));
      } else {
        trackers = [...p.trackers, after];
      }
      return {
        ...checked,
        trackers,
        ledger: [...p.ledger, sessionChangeRow(event)],
      };
    }
    case "journal.entry.added":
      return {
        ...p,
        journal: [
          ...p.journal,
          {
            seq: event.seq,
            ts: event.ts,
            actor: event.actor,
            visibility: event.visibility,
            entryId: event.payload.entryId,
            title: event.payload.title,
            body: event.payload.body,
            sourceActionIds: event.payload.sourceActionIds,
          },
        ],
      };
    default:
      return applyMechanics(p, event as MechanicsEvent);
  }
}

function applyUnsafe(
  p: SessionProjections,
  stored: StoredEvent,
): SessionProjections {
  // Visibility first: a hidden event is dropped uncounted and does not move throughSeq.
  if (!canSee(p.viewer, stored.visibility)) return p;
  if (p.viewer.role === "player" && stored.type === "tracker.changed") return p;
  if (stored.seq <= p.throughSeq) return bump(p, "outOfOrder");
  const moved: SessionProjections = { ...p, throughSeq: stored.seq };
  const decoded = decodeEvent(stored);
  switch (decoded.status) {
    case "unknown-type":
      return bump(moved, "skippedUnknownType");
    case "unknown-version":
      return bump(moved, "skippedUnknownVersion");
    case "invalid":
      return bump(moved, "skippedInvalid");
    case "known":
      return applyKnown(moved, decoded.event);
  }
}

/** Folds one row. Pure; never throws; never mutates its inputs. */
export function applyEvent(
  p: SessionProjections,
  event: StoredEvent,
): SessionProjections {
  try {
    return applyUnsafe(p, event);
  } catch {
    // Total over any stream: an unforeseen failure counts as an invalid event.
    const seq = typeof event?.seq === "number" ? event.seq : p.throughSeq;
    return bump(
      { ...p, throughSeq: Math.max(p.throughSeq, seq) },
      "skippedInvalid",
    );
  }
}

/** The whole fold: identical to events.reduce(applyEvent, emptyProjections(viewer)). */
export function project(
  events: Iterable<StoredEvent>,
  viewer: Viewer,
): SessionProjections {
  let p = emptyProjections(viewer);
  for (const event of events) p = applyEvent(p, event);
  return p;
}
