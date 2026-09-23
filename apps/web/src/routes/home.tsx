import { useIdentity, useSignOut } from "../auth/useAuth";

/** US2 AC2/AC5: the signed-in view, showing the person's own display name. */
export function HomeView() {
  const identity = useIdentity();
  const signOut = useSignOut();

  return (
    <div>
      <p>
        Signed in as <strong>{identity.data?.displayName}</strong>
      </p>
      <button
        type="button"
        onClick={() => signOut.mutate()}
        disabled={signOut.isPending}
      >
        Sign out
      </button>
      <p>
        No session registry exists (spec 007, D6) — open{" "}
        <code>/play/&lt;session-id&gt;</code> directly to join a play session.
      </p>
    </div>
  );
}
