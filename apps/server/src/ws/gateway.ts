import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { ServerType } from "@hono/node-server";
import { WebSocketServer } from "ws";
import { SESSION_COOKIE_NAME } from "../auth/middleware.js";
import type {
  DbClient,
  SessionIdentity,
  ValidateSession,
} from "../auth/session.js";
import { append } from "../events/log.js";
import type { ErrorFrame, RecordedEventFrame, SendFrame } from "./protocol.js";
import { parseInboundFrame, toEventPayload } from "./protocol.js";
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
}

/**
 * Builds the WebSocket gateway. `attach(server)` wires it onto an existing
 * HTTP server so both share one port and one process (FR-001, architecture
 * A2) — `ws`'s `noServer: true` mode is what lets authentication run on the
 * upgrade request BEFORE the handshake completes, instead of `ws` accepting
 * the connection itself and only then handing it to application code.
 */
export function createGateway({ db, validateSession }: CreateGatewayOptions) {
  const wss = new WebSocketServer({ noServer: true });
  const registry = createRegistry();

  function attach(server: ServerType): void {
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

    wss.handleUpgrade(request, socket, head, (ws) => {
      const conn: Connection = {
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
    conn.socket.on("message", (data: Buffer | ArrayBuffer | Buffer[]) => {
      handleMessage(conn, data.toString()).catch((err: unknown) => {
        console.error("ws: message handler crashed", err);
        sendError(conn, "internal", "An internal error occurred.");
      });
    });
    conn.socket.on("close", () => {
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
  ): void {
    if (conn.socket.readyState !== conn.socket.OPEN) return;
    const frame: ErrorFrame = { type: "error", kind, message };
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
      await subscribeWithReplay(
        db,
        registry,
        conn,
        parsed.frame.sessionId,
        parsed.frame.afterSeq ?? 0,
      );
      return;
    }

    await handleSend(conn, parsed.frame);
  }

  async function handleSend(conn: Connection, frame: SendFrame): Promise<void> {
    // FR-004: append BEFORE broadcast — never the reverse. A broadcast that
    // preceded the append could deliver an event that was never recorded,
    // and if the append then failed, clients would have seen something the
    // log doesn't contain. `append` itself validates seq/ts are absent, so
    // a failure here throws and nothing is ever sent to `registry.broadcast`.
    const recorded = await append(db, {
      sessionId: frame.sessionId,
      // FR-005: actor is the connection's authenticated identity, never the
      // frame's — `frame` (SendFrame) has no `actor` field for it to come
      // from in the first place (protocol.ts strips it at parse time).
      actor: conn.userId,
      type: frame.eventType,
      payload: frame.payload,
      payloadVersion: frame.payloadVersion,
      visibility: frame.visibility,
    });

    const eventFrame: RecordedEventFrame = {
      type: "event",
      event: toEventPayload(recorded),
    };
    registry.broadcast(frame.sessionId, eventFrame);
  }

  return { attach, registry };
}

export type Gateway = ReturnType<typeof createGateway>;
