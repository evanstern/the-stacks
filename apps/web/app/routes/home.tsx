import { useState } from "react";
import { useRevalidator, useRouteLoaderData } from "react-router";
import { signOut } from "~/auth";
import { Button } from "~/components/ui/button";
import type { loader as rootLoader } from "~/root";

/** US2 AC2/AC5: the signed-in view, showing the person's own display name. */
export default function Home() {
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const revalidator = useRevalidator();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    await signOut();
    revalidator.revalidate();
  }

  return (
    <div>
      <p>
        Signed in as <strong>{root?.user?.displayName}</strong>
      </p>
      <Button
        type="button"
        onClick={() => void handleSignOut()}
        disabled={pending}
      >
        Sign out
      </Button>
      <p>
        No session registry exists (spec 007, D6) — open{" "}
        <code>/play/&lt;session-id&gt;</code> directly to join a play session.
      </p>
    </div>
  );
}
