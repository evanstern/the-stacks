import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { ServerType } from "@hono/node-server";
import {
  currentVersion,
  GATE_REQUEST_KINDS,
  GATE_REQUEST_VERSION,
  type StoredEvent,
} from "@the-stacks/session-model";
import { eq } from "drizzle-orm";
import { WebSocketServer } from "ws";
import { SESSION_COOKIE_NAME } from "../auth/middleware.js";
import type {
  DbClient,
  SessionIdentity,
  ValidateSession,
} from "../auth/session.js";
import { readFrom } from "../events/log.js";
import type { Gate, GateResult } from "../gate/index.js";
import {
  createPresence,
  HEARTBEAT_INTERVAL_MS,
  type PresenceTracker,
} from "../presence/index.js";
import { users } from "../schema/auth.js";
import type { ErrorFrame, RecordedEventFrame, SendFrame } from "./protocol.js";
import { parseInboundFrame } from "./protocol.js";
import type { Connection } from "./registry.js";
import { createRegistry } from "./registry.js";
import { subscribe as subscribeWithReplay } from "./subscribe.js";

/** GET /ws — the only path this gateway upgrades (contracts/ws-protocol.md). */
const WS_PATH = "/ws";

/**
 * `ServerType` (what `serve()` returns) is a union that also covers http2
 * servers, whose sockets don't emit `upgrade` the same way — this app only
 * ever runs plain `node:http` (index.ts passes no http2 options), so
 * narrowing to this shape for the one event we listen for is safe.
 */
interface UpgradableServer {
  on(
    event: "upgrade",
    listener: (request: IncomingMessage, socket: Duplex, head: Buffer) => void,
  ): void;
}

/**
 * A tiny, dependency-free `Cookie:` header parser. Not Hono's `getCookie` —
 * that takes a Hono `Context`, and the upgrade handler has none (the same
 * reason spec 005's `validateSession` takes a bare token, not a `Request`).
 */
function readCookie(
  header: string | undefined,
  name: string,
): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
}

/**
 * Refuses the upgrade with a bare status line and closes the socket — the
 * WebSocket handshake never completes (research D4). `401` for no/invalid
 * session, `503` when validation couldn't be performed at all (FR-013).
 */
function refuseUpgrade(
  socket: Duplex,
  status: 401 | 503,
  message: string,
): void {
  const statusText = status === 401 ? "Unauthorized" : "Service Unavailable";
  socket.write(
    `HTTP/1.1 ${status} ${statusText}\r\n` +
      "Connection: close\r\n" +
      "Content-Type: text/plain\r\n" +
      `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`,
  );
  socket.destroy();
}

export interface CreateGatewayOptions {
  db: DbClient;
  validateSession: ValidateSession;
  /** Receives gate request kinds sent over `send` (spec 029 ws-delivery.md). */
  gate: Gate;
  /** The presence tracker (decision-0024). Default: a private one, for tests that do not read presence. */
  presence?: PresenceTracker;
  /** Ping cadence; tests shorten it. Default HEARTBEAT_INTERVAL_MS. */
  heartbeatIntervalMs?: number;
}

/** Gate refusal codes the sender is not entitled to (a `forbidden` error frame). */
const FORBIDDEN_GATE_CODES = new Set([
  "NOT_AUTHORIZED",
  "NOT_DM",
  "COMMIT_NOT_ALLOWED",
  "GROUP_SIGNOFF_REQUIRED",
  "NOT_YOUR_ACTOR",
  "DM_SEAT_REQUIRED",
  "NOT_YOUR_TURN",
]);

function errorKindFor(
  refusal: Extract<GateResult, { ok: false }>["refusal"],
): ErrorFrame["kind"] {
  if (refusal.source === "gate") {
    if (FORBIDDEN_GATE_CODES.has(refusal.code)) return "forbidden";
    if (refusal.code === "CONFLICT") return "internal";
  }
  return "validation";
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Builds the WebSocket gateway. `attach(server)` wires it onto an existing
 * HTTP server so both share one port and one process (FR-001, architecture
 * A2) — `ws`'s `noServer: true` mode is what lets authentication run on the
 * upgrade request BEFORE the handshake completes, instead of `ws` accepting
 * the connection itself and only then handing it to application code.
 */
export function createGateway({
  db,
  validateSession,
  gate,
  presence = createPresence(),
  heartbeatIntervalMs = HEARTBEAT_INTERVAL_MS,
}: CreateGatewayOptions) {
  const wss = new WebSocketServer({ noServer: true });
  const registry = createRegistry();
  /** Every open connection, subscribed or not: the heartbeat pings all of them. */
  const connections = new Set<Connection>();

  // A presence change reaches every opted-in subscriber of that table.
  presence.reader.onChange((sessionId) => {
    registry.sendPresence(sessionId, {
      type: "presence",
      sessionId,
      present: presence.reader.presentUsers(sessionId),
    });
  });

  // Protocol-level ping (decision-0024): a connection that has not answered the
  // previous ping is terminated, which runs the normal close path and so
  // starts its grace window. No frame is involved.
  const heartbeat = setInterval(() => {
    for (const conn of connections) {
      if (!conn.alive) {
        conn.socket.terminate();
        continue;
      }
      conn.alive = false;
      try {
        conn.socket.ping();
      } catch (err) {
        console.error("ws: ping failed", err);
      }
    }
  }, heartbeatIntervalMs);
  heartbeat.unref();

  function close(): void {
    clearInterval(heartbeat);
  }

  function attach(server: ServerType): void {
    (server as unknown as { on(e: "close", l: () => void): void }).on(
      "close",
      close,
    );
    (server as unknown as UpgradableServer).on(
      "upgrade",
      (request: IncomingMessage, socket: Duplex, head: Buffer) => {
        handleUpgrade(request, socket, head).catch((err: unknown) => {
          console.error("ws: upgrade handler crashed", err);
          socket.destroy();
        });
      },
    );
  }

  async function handleUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): Promise<void> {
    const path = (request.url ?? "").split("?")[0];
    if (path !== WS_PATH) {
      socket.destroy();
      return;
    }

    // research D4: never a query-string token (logged by proxies) — only
    // the HttpOnly cookie already sent on the upgrade request.
    const token = readCookie(request.headers.cookie, SESSION_COOKIE_NAME);
    if (!token) {
      refuseUpgrade(socket, 401, "Authentication required.");
      return;
    }

    let identity: SessionIdentity | null;
    try {
      identity = await validateSession(token);
    } catch (err) {
      // FR-013: validateSession THROWS when the datastore is unreachable —
      // that is not "invalid session". Refuse distinctly (503) so a client
      // retries rather than treating a database blip as signed out.
      console.error("ws: validateSession threw (datastore unreachable?)", err);
      refuseUpgrade(socket, 503, "Could not verify session; try again.");
      return;
    }

    if (!identity) {
      refuseUpgrade(socket, 401, "Invalid or expired session.");
      return;
    }

    // Read once at upgrade (data-model.md); a missing row falls back to the id.
    let displayName = identity.userId;
    try {
      const [row] = await db
        .select({ displayName: users.displayName })
        .from(users)
        .where(eq(users.id, identity.userId))
        .limit(1);
      if (row) displayName = row.displayName;
    } catch (err) {
      console.error("ws: display name lookup failed", err);
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      const conn: Connection = {
        connId: randomUUID(),
        displayName,
        wantsPresence: false,
        alive: true,
        socket: ws,
        userId: identity.userId,
        role: identity.role,
        sessionId: null,
        pendingQueue: null,
        replayedThroughSeq: 0,
      };
      handleConnection(conn);
    });
  }

  function handleConnection(conn: Connection): void {
    connections.add(conn);
    conn.socket.on("pong", () => {
      conn.alive = true;
    });
    conn.socket.on("message", (data: Buffer | ArrayBuffer | Buffer[]) => {
      handleMessage(conn, data.toString()).catch((err: unknown) => {
        console.error("ws: message handler crashed", err);
        sendError(conn, "internal", "An internal error occurred.");
      });
    });
    conn.socket.on("close", () => {
      connections.delete(conn);
      if (conn.sessionId !== null) presence.leave(conn.sessionId, conn.connId);
      registry.unsubscribe(conn);
    });
    conn.socket.on("error", (err: unknown) => {
      console.error("ws: socket error", err);
    });
  }

  function sendError(
    conn: Connection,
    kind: ErrorFrame["kind"],
    message: string,
    code?: string,
  ): void {
    if (conn.socket.readyState !== conn.socket.OPEN) return;
    const frame: ErrorFrame =
      code === undefined
        ? { type: "error", kind, message }
        : { type: "error", kind, message, code };
    conn.socket.send(JSON.stringify(frame));
  }

  async function handleMessage(conn: Connection, raw: string): Promise<void> {
    const parsed = parseInboundFrame(raw);
    if (!parsed.ok) {
      // The connection stays open — one bad frame is not a reason to
      // disconnect a client that may immediately send a good one. Full
      // refusal-path coverage (T016-T019) is Phase 4; this is the minimal
      // behavior the message loop needs to have *something* defined here.
      sendError(conn, "validation", parsed.message);
      return;
    }

    if (parsed.frame.type === "subscribe") {
      // The replay/live boundary (research D1, ws/subscribe.ts): joins the
      // registry with delivery queued, replays from afterSeq in bounded
      // batches, then drains the queue with a position-based skip.
      // Presence: leave the previous table, join this one, for every
      // connection whether or not it opted in to presence frames.
      if (conn.sessionId !== null) presence.leave(conn.sessionId, conn.connId);
      conn.wantsPresence = parsed.frame.presence === true;
      presence.join(parsed.frame.sessionId, {
        connId: conn.connId,
        userId: conn.userId,
        displayName: conn.displayName,
      });
      await subscribeWithReplay(
        db,
        registry,
        conn,
        parsed.frame.sessionId,
        parsed.frame.afterSeq ?? 0,
        { readFrom, presence: presence.reader },
      );
      return;
    }

    await handleSend(conn, parsed.frame);
  }

  /**
   * Classifies a `send` (specs/029-proposal-gate/contracts/ws-delivery.md): a gate
   * request kind goes to the gate; any other type is refused
   * (`CATALOG_TYPE_REQUIRES_GATE` when catalogued, `UNKNOWN_EVENT_TYPE` otherwise).
   */
  async function handleSend(conn: Connection, frame: SendFrame): Promise<void> {
    if (GATE_REQUEST_KINDS.includes(frame.eventType)) {
      if (frame.payloadVersion !== GATE_REQUEST_VERSION) {
        sendError(
          conn,
          "validation",
          `Gate requests use payloadVersion ${GATE_REQUEST_VERSION}.`,
        );
        return;
      }
      if (!isJsonObject(frame.payload)) {
        sendError(
          conn,
          "validation",
          "A gate request payload must be an object.",
        );
        return;
      }
      const request = {
        ...frame.payload,
        kind: frame.eventType,
        ...(frame.visibility !== undefined
          ? { visibility: frame.visibility }
          : {}),
      };
      const result = await gate.handle(
        frame.sessionId,
        { kind: "human", userId: conn.userId, role: conn.role },
        request,
      );
      // On success nothing is sent directly: the gate's onAppended publishes
      // the rows to every entitled subscriber, the sender included.
      if (!result.ok) {
        sendError(
          conn,
          errorKindFor(result.refusal),
          result.refusal.message,
          result.refusal.code,
        );
      }
      return;
    }

    if (currentVersion(frame.eventType) !== undefined) {
      sendError(
        conn,
        "forbidden",
        `The event type ${frame.eventType} is written through the gate.`,
        "CATALOG_TYPE_REQUIRES_GATE",
      );
      return;
    }

    sendError(
      conn,
      "validation",
      `The event type ${frame.eventType} is not catalogued.`,
      "UNKNOWN_EVENT_TYPE",
    );
  }

  /** Broadcasts stored rows in order; each subscriber receives only what it may see. */
  function publish(sessionId: string, events: readonly StoredEvent[]): void {
    for (const event of events) {
      // The settled narration row replaces the stream: `end` leaves first, then the row.
      if (event.type === "narration" && event.actor === "ai:dm") {
        registry.endNarration(sessionId);
      }
      const eventFrame: RecordedEventFrame = {
        type: "event",
        event: {
          sessionId: event.sessionId,
          seq: event.seq,
          actor: event.actor,
          type: event.type,
          payload: event.payload,
          payloadVersion: event.payloadVersion,
          visibility: event.visibility,
          ts: event.ts,
        },
      };
      registry.broadcast(sessionId, eventFrame);
    }
  }

  /** Spec 108: ephemeral narration part from the DM worker; never logged. */
  function streamNarration(
    sessionId: string,
    part: Parameters<typeof registry.streamNarration>[1],
  ): void {
    registry.streamNarration(sessionId, part);
  }

  return { attach, registry, publish, streamNarration, close };
}

export type Gateway = ReturnType<typeof createGateway>;
