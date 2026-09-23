import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { identityKey } from "../auth/useAuth";
import type { RecordedEvent, ServerFrame } from "./types";

export type ConnectionStatus = "connecting" | "open" | "retrying";

const RETRY_DELAY_MS = 1000;

/**
 * Subscribes to one play session over /ws and tracks its event log
 * (spec T017-T024). Replayed and live events arrive as the same `event`
 * frame (FR-010) and are appended to one list through one path here.
 *
 * `highestSeqRef` is the "highest delivered seq" the plan requires
 * (D4/FR-011): it is used verbatim as `afterSeq` on (re)connect, and is
 * NEVER incremented to guess a "next expected" value — seq gaps caused by
 * visibility filtering are correct, not missed events.
 */
export function useSession(sessionId: string) {
  const queryClient = useQueryClient();
  const [events, setEvents] = useState<RecordedEvent[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [caughtUp, setCaughtUp] = useState(false);
  const highestSeqRef = useRef(0);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let stopped = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    setEvents([]);
    setCaughtUp(false);
    highestSeqRef.current = 0;

    function scheduleRetry() {
      setStatus("retrying");
      retryTimer = setTimeout(() => void attempt(), RETRY_DELAY_MS);
    }

    async function attempt(): Promise<void> {
      if (stopped) return;
      setStatus("connecting");

      // The browser WebSocket API never exposes the HTTP status of a
      // refused upgrade — a non-101 response just fails the connection
      // (generic close, code 1006, empty reason), by spec design, so a
      // page script can't port-scan via WebSocket. /auth/me exercises the
      // identical validateSession seam the upgrade does and DOES expose
      // its status, so it stands in as the 401-vs-503 oracle FR-014 needs.
      let authenticated: boolean;
      try {
        const res = await fetch("/auth/me", { credentials: "same-origin" });
        if (res.status === 401) {
          // Same move as a real /auth/me 401 elsewhere: flip identity, and
          // the root view returns to sign-in (FR-014's "401 -> sign in").
          queryClient.setQueryData(identityKey, null);
          return;
        }
        authenticated = res.ok;
      } catch {
        authenticated = false;
      }
      if (stopped) return;
      if (!authenticated) {
        // Datastore blip or other transient failure: retry, don't sign out
        // (FR-014's "503 -> retry").
        scheduleRetry();
        return;
      }

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        if (stopped) return;
        setStatus("open");
        socket.send(
          JSON.stringify({
            type: "subscribe",
            sessionId,
            afterSeq: highestSeqRef.current,
          }),
        );
      });

      socket.addEventListener("message", (messageEvent: MessageEvent) => {
        const frame = JSON.parse(String(messageEvent.data)) as ServerFrame;
        if (frame.type === "event") {
          highestSeqRef.current = Math.max(
            highestSeqRef.current,
            frame.event.seq,
          );
          setEvents((prev) => [...prev, frame.event]);
        } else if (frame.type === "replay-complete") {
          setCaughtUp(true);
        } else if (frame.type === "error") {
          // FR-015: a refused frame is not a reason to disconnect. There's
          // nothing else to do here — the connection is deliberately left
          // exactly as it was.
          console.warn("ws: request refused", frame);
        }
      });

      socket.addEventListener("close", () => {
        if (stopped) return;
        scheduleRetry();
      });
    }

    void attempt();

    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [sessionId, queryClient]);

  const send = useCallback(
    (text: string): boolean => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return false;
      // FR-012: only permitted fields. Never actor/seq/ts — the server
      // assigns those, and D5/FR-013 means we don't render this locally;
      // it renders only once its `event` frame comes back.
      socket.send(
        JSON.stringify({
          type: "send",
          sessionId,
          eventType: "chat",
          payload: { text },
          payloadVersion: 1,
        }),
      );
      return true;
    },
    [sessionId],
  );

  return { events, status, caughtUp, send };
}
