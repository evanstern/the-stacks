import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createSession } from "../src/auth/session.js";
import { createDb, probeReachable } from "../src/db.js";
import { append } from "../src/events/log.js";
import { users } from "../src/schema/auth.js";

// TASK-0175 (spec 069): GET /api/tables lists the signed-in account's tables.

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const db = databaseUrl ? createDb(databaseUrl) : undefined;
const reachable = db ? await probeReachable(db.$client, 2000) : false;
if (!reachable && process.env.REQUIRE_DATABASE === "1") {
  throw new Error("tables.integration.test.ts needs a reachable database");
}
afterAll(async () => {
  await db?.$client.end();
});

function requireDb() {
  if (!db) throw new Error("this test requires a database");
  return db;
}

async function account(role: "operator" | "player") {
  const [row] = await requireDb()
    .insert(users)
    .values({
      username: `test-${randomUUID()}`,
      displayName: "Test User",
      role,
      passwordHash: "unused",
    })
    .returning({ id: users.id });
  const id = (row as { id: string }).id;
  const session = await createSession(requireDb(), id);
  return { id, cookie: `session=${session.token}` };
}

const app = () =>
  createApp({
    databaseProbe: { reachable: async () => true },
    db: requireDb(),
    dm: { nudge: () => {} },
  });

function row(
  sessionId: string,
  type: string,
  payload: unknown,
  visibility = "public",
) {
  return append(requireDb(), {
    sessionId,
    actor: "dm",
    type,
    payload,
    payloadVersion: 1,
    visibility,
  });
}

const seat = (sessionId: string, characterId: string, userId: string | null) =>
  row(sessionId, "party.member.changed", {
    reason: "seat",
    characterId,
    before: null,
    after: userId
      ? {
          characterId,
          name: characterId,
          controller: { kind: "player", userId },
          combatantId: null,
        }
      : null,
  });

const scene = (sessionId: string, title: string, visibility = "public") =>
  row(
    sessionId,
    "scene.changed",
    { reason: "scene", before: null, after: { title } },
    visibility,
  );

const dmSeat = (sessionId: string, after: unknown) =>
  row(sessionId, "dm.seat.changed", { reason: "seat", after });

type Table = {
  sessionId: string;
  title: string | null;
  lastActivityAt: string | null;
  relation: string;
};
async function listFor(cookie: string): Promise<Table[]> {
  const res = await app().request("/api/tables", { headers: { cookie } });
  expect(res.status).toBe(200);
  return ((await res.json()) as { tables: Table[] }).tables;
}

describe.skipIf(!reachable)("GET /api/tables", () => {
  it("lists a player's tables newest first, with title and activity", async () => {
    const p = await account("player");
    const a = randomUUID();
    const b = randomUUID();
    await seat(a, "c1", p.id);
    await scene(a, "Table A");
    await seat(b, "c1", p.id);
    await scene(b, "Table B");
    const tables = await listFor(p.cookie);
    expect(tables.map((t) => t.sessionId)).toEqual([b, a]);
    expect(tables[0]).toMatchObject({ title: "Table B", relation: "player" });
    expect(Number.isNaN(Date.parse(tables[0]?.lastActivityAt ?? ""))).toBe(
      false,
    );
  });

  it("never lists a table where the player holds no seat", async () => {
    const p = await account("player");
    const other = await account("player");
    const a = randomUUID();
    const c = randomUUID();
    await seat(a, "c1", p.id);
    await seat(c, "c1", other.id);
    await scene(c, "Not yours");
    const ids = (await listFor(p.cookie)).map((t) => t.sessionId);
    expect(ids).toContain(a);
    expect(ids).not.toContain(c);
  });

  it("drops a table when the seat is removed", async () => {
    const p = await account("player");
    const a = randomUUID();
    await seat(a, "c1", p.id);
    expect((await listFor(p.cookie)).map((t) => t.sessionId)).toEqual([a]);
    await seat(a, "c1", null);
    expect(await listFor(p.cookie)).toEqual([]);
  });

  it("lists a human DM seat as dm, and drops it when the AI returns", async () => {
    const p = await account("player");
    const a = randomUUID();
    await dmSeat(a, { kind: "human", userId: p.id });
    expect(await listFor(p.cookie)).toMatchObject([
      { sessionId: a, relation: "dm" },
    ]);
    await dmSeat(a, { kind: "ai" });
    expect(await listFor(p.cookie)).toEqual([]);
  });

  it("gives the operator every table, started ones marked", async () => {
    const op = await account("operator");
    const p = await account("player");
    const a = randomUUID();
    const b = randomUUID();
    const c = randomUUID();
    await seat(a, "c1", p.id);
    await seat(b, "c1", p.id);
    await seat(c, "c1", randomUUID());
    await scene(c, "Operator only");
    const tables = await listFor(op.cookie);
    const ids = tables.map((t) => t.sessionId);
    expect(ids).toEqual(expect.arrayContaining([a, b, c]));
    expect(ids.indexOf(c)).toBeLessThan(ids.indexOf(b));
    expect(ids.indexOf(b)).toBeLessThan(ids.indexOf(a));
    expect(tables.find((t) => t.sessionId === c)).toMatchObject({
      relation: "started",
      title: "Operator only",
    });
  });

  it("ignores dm-only rows for title and activity", async () => {
    const p = await account("player");
    const a = randomUUID();
    await seat(a, "c1", p.id);
    await scene(a, "Public title");
    const before = (await listFor(p.cookie))[0]?.lastActivityAt;
    await scene(a, "Secret title", "dm-only");
    const after = (await listFor(p.cookie))[0];
    expect(after?.title).toBe("Public title");
    expect(after?.lastActivityAt).toBe(before);
  });

  it("returns a null title when no scene has started", async () => {
    const p = await account("player");
    const a = randomUUID();
    await seat(a, "c1", p.id);
    expect((await listFor(p.cookie))[0]?.title).toBeNull();
  });

  it("refuses an anonymous read with 401", async () => {
    const res = await app().request("/api/tables");
    expect(res.status).toBe(401);
  });
});
