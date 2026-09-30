import { useState } from "react";
import { useRevalidator, useRouteLoaderData } from "react-router";
import { signOut } from "~/auth";
import type { loader as rootLoader } from "~/root";
import type { RecordedEvent } from "~/ws/types";
import { useSession } from "~/ws/useSession";
import type { Route } from "./+types/play";

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  return { sessionId: params.sessionId };
}

export function HydrateFallback() {
  return <p>Loading…</p>;
}

function eventText(event: RecordedEvent): string {
  const payload = event.payload as { text?: unknown } | null;
  return typeof payload?.text === "string"
    ? payload.text
    : JSON.stringify(event.payload);
}

/** US3: replayed + live events through one path (T019); US4's demo view. */
export default function Play({ loaderData }: Route.ComponentProps) {
  const { sessionId } = loaderData;
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const revalidator = useRevalidator();
  const { events, status, caughtUp, send } = useSession(
    sessionId,
    revalidator.revalidate,
  );
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    await signOut();
    revalidator.revalidate();
  }

  return (
    <div>
      <p>
        Signed in as <strong>{root?.user?.displayName}</strong> — {status}
        <button
          type="button"
          onClick={() => void handleSignOut()}
          disabled={pending}
        >
          Sign out
        </button>
      </p>
      <p>
        Session: <code>{sessionId}</code>
      </p>
      {!caughtUp && <p>Loading history…</p>}
      {caughtUp && events.length === 0 && <p>No events yet.</p>}
      <ul>
        {events.map((event) => (
          <li key={`${event.sessionId}-${event.seq}`}>
            <strong>{event.actor}</strong>: {eventText(event)}
          </li>
        ))}
      </ul>
      <form
        onSubmit={(formEvent) => {
          formEvent.preventDefault();
          const text = draft.trim();
          if (text.length === 0) return;
          // D5/FR-013: no optimistic append here. The message renders only
          // when its own `event` frame comes back over the socket, above.
          if (send(text)) setDraft("");
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" disabled={status !== "open"}>
          Send
        </button>
      </form>
    </div>
  );
}
