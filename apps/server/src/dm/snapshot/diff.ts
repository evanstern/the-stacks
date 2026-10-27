import type {
  ActorChange,
  ActorSnapshot,
  SnapshotActor,
  SnapshotDiff,
  StageChange,
} from "./types.js";

/** The S0-to-S1 change list (contract §5). Pure; actors match by id. */

const same = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

function actorChanges(a: SnapshotActor, b: SnapshotActor): ActorChange[] {
  const out: ActorChange[] = [];
  const id = b.id;
  if (
    (a.hp?.current ?? null) !== (b.hp?.current ?? null) ||
    (a.hp?.temp ?? null) !== (b.hp?.temp ?? null)
  ) {
    if (a.hp && b.hp) {
      out.push({
        kind: "hp",
        actorId: id,
        before: { current: a.hp.current, temp: a.hp.temp },
        after: { current: b.hp.current, temp: b.hp.temp },
      });
    }
  }
  if (a.lifeState !== b.lifeState) {
    out.push({
      kind: "life-state",
      actorId: id,
      before: a.lifeState,
      after: b.lifeState,
    });
  }
  const before = new Map(a.conditions.map((c) => [c.instanceId, c]));
  const after = new Map(b.conditions.map((c) => [c.instanceId, c]));
  for (const c of b.conditions)
    if (!before.has(c.instanceId))
      out.push({
        kind: "condition",
        actorId: id,
        op: "applied",
        condition: c.condition,
      });
  for (const c of a.conditions)
    if (!after.has(c.instanceId))
      out.push({
        kind: "condition",
        actorId: id,
        op: "removed",
        condition: c.condition,
      });
  if (a.presence !== b.presence) {
    out.push({
      kind: "presence",
      actorId: id,
      before: a.presence,
      after: b.presence,
    });
  }
  if (a.initiative !== b.initiative) {
    out.push({
      kind: "initiative",
      actorId: id,
      before: a.initiative,
      after: b.initiative,
    });
  }
  if (!same(a.resources, b.resources)) {
    out.push({
      kind: "resources",
      actorId: id,
      before: a.resources,
      after: b.resources,
    });
  }
  return out;
}

const activeOf = (s: ActorSnapshot): string | null =>
  s.stage.tableMode.mode === "turn"
    ? (s.stage.tableMode.activeActorId ?? s.stage.tableMode.activeActor)
    : null;

export function diffSnapshots(
  s0: ActorSnapshot,
  s1: ActorSnapshot,
): SnapshotDiff {
  const old = new Map(s0.actors.map((a) => [a.id, a]));
  const now = new Set(s1.actors.map((a) => a.id));
  const actors: ActorChange[] = [];
  for (const b of s1.actors) {
    const a = old.get(b.id);
    if (!a) actors.push({ kind: "joined", actorId: b.id });
    else actors.push(...actorChanges(a, b));
  }
  for (const a of s0.actors)
    if (!now.has(a.id))
      actors.push({ kind: "left", actorId: a.id, name: a.name });

  const stage: StageChange[] = [];
  const m0 = s0.stage.tableMode.mode;
  const m1 = s1.stage.tableMode.mode;
  if (m0 !== m1) stage.push({ kind: "table-mode", before: m0, after: m1 });
  const act0 = activeOf(s0);
  const act1 = activeOf(s1);
  if (act0 !== act1)
    stage.push({ kind: "active-actor", before: act0, after: act1 });
  const e0 = s0.stage.encounter;
  const e1 = s1.stage.encounter;
  if (!e0 && e1) stage.push({ kind: "encounter-started" });
  if (e0 && !e1) stage.push({ kind: "encounter-ended" });
  if (e0 && e1 && e0.round !== e1.round)
    stage.push({ kind: "round", before: e0.round, after: e1.round });
  const t0 = new Map(s0.stage.trackers.map((t) => [t.trackerId, t.filled]));
  const t1 = new Map(s1.stage.trackers.map((t) => [t.trackerId, t.filled]));
  for (const id of new Set([...t1.keys(), ...t0.keys()])) {
    const before = t0.get(id) ?? null;
    const after = t1.get(id) ?? null;
    if (before !== after)
      stage.push({ kind: "tracker", trackerId: id, before, after });
  }
  const sc0 = s0.stage.scene?.sceneId ?? null;
  const sc1 = s1.stage.scene?.sceneId ?? null;
  if (sc0 !== sc1) stage.push({ kind: "scene", before: sc0, after: sc1 });

  return { fromSeq: s0.throughSeq, toSeq: s1.throughSeq, actors, stage };
}
